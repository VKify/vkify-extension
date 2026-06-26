/**
 * Tests for ApiQueue — the concurrency-capped queue + flood-retry that wraps
 * every VKApiService.call(). Two invariants matter: never exceed the concurrency
 * cap, and retry only on VK flood errors (not on arbitrary failures).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiQueue } from '../content/core/api/rate-limiter.js';

const flush = () => new Promise(r => setTimeout(r, 0));

describe('ApiQueue – concurrency', () => {
  it('returns task results in order', async () => {
    const q = new ApiQueue();
    const results = await Promise.all([
      q.run(() => Promise.resolve(1)),
      q.run(() => Promise.resolve(2)),
      q.run(() => Promise.resolve(3)),
    ]);
    expect(results).toEqual([1, 2, 3]);
  });

  it('never exceeds the configured concurrency', async () => {
    const q = new ApiQueue({ concurrency: 2 });
    let active = 0;
    let peak = 0;
    const release: Array<() => void> = [];

    const make = () => q.run(() => new Promise<void>(resolve => {
      active++;
      peak = Math.max(peak, active);
      release.push(() => { active--; resolve(); });
    }));

    const all = [make(), make(), make(), make()];
    await flush();

    // Only 2 may run at once; drain them one wave at a time.
    while (release.length) release.shift()!();
    await flush();
    while (release.length) release.shift()!();
    await Promise.all(all);

    expect(peak).toBe(2);
  });
});

describe('ApiQueue – flood retry', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('retries a flood error and eventually succeeds', async () => {
    const q = new ApiQueue({ maxRetries: 2, retryBaseMs: 10 });
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('Too many requests per second'))
      .mockResolvedValueOnce('ok');

    const p = q.run(task);
    await vi.runAllTimersAsync();

    await expect(p).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-flood errors', async () => {
    const q = new ApiQueue({ maxRetries: 3, retryBaseMs: 10 });
    const task = vi.fn().mockRejectedValue(new Error('Access denied'));

    const p = q.run(task);
    await expect(p).rejects.toThrow('Access denied');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('gives up after maxRetries flood errors', async () => {
    const q = new ApiQueue({ maxRetries: 2, retryBaseMs: 10 });
    const task = vi.fn().mockRejectedValue(new Error('Flood control'));

    const p = q.run(task);
    const assertion = expect(p).rejects.toThrow('Flood control');
    await vi.runAllTimersAsync();
    await assertion;

    expect(task).toHaveBeenCalledTimes(3); // original + 2 retries
  });
});
