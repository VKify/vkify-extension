// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSharedContext } from '../content/features/ads-blocking/shared.js';

const set = vi.fn(async () => {});

beforeEach(() => {
  vi.useFakeTimers();
  set.mockClear();
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: vi.fn(async () => ({})), set },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('audio ad statistics', () => {
  it('persists network interceptions in the ads counter and shared journal', async () => {
    const shared = createSharedContext();
    await shared.loadStats();
    shared.addListenerUser();
    window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', domain: 'r.mradx.net', url: 'https://r.mradx.net/audio/test.mp3',
      detail: 'Аудиореклама · сетевой запрос', method: 'network',
    } }));

    await vi.advanceTimersByTimeAsync(1_500);
    shared.releaseListenerUser();

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      stats_ads_blocked: 1,
      stats_block_log: [expect.objectContaining({
        kind: 'ad', domain: 'r.mradx.net', method: 'network',
      })],
    }));
  });
});
