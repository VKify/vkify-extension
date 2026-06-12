import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coalesceFrame } from '../content/utils/raf-coalesce.js';

describe('coalesceFrame', () => {
  let pending: Array<() => void>;
  let nextId: number;

  beforeEach(() => {
    pending = [];
    nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      pending.push(cb);
      return nextId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      // single-frame model: clearing drops every queued callback for the id
      if (id > 0) pending = [];
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Runs everything currently queued for the "next frame". */
  function flushFrame(): void {
    const batch = pending;
    pending = [];
    for (const cb of batch) cb();
  }

  it('collapses many calls within one frame into a single invocation', () => {
    const fn = vi.fn();
    const scheduled = coalesceFrame(fn);

    scheduled();
    scheduled();
    scheduled();
    expect(fn).not.toHaveBeenCalled(); // nothing runs until the frame

    flushFrame();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs again on the next frame after the first fired', () => {
    const fn = vi.fn();
    const scheduled = coalesceFrame(fn);

    scheduled();
    flushFrame();
    scheduled();
    flushFrame();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel() prevents a pending invocation', () => {
    const fn = vi.fn();
    const scheduled = coalesceFrame(fn);

    scheduled();
    scheduled.cancel();
    flushFrame();

    expect(fn).not.toHaveBeenCalled();
  });

  it('reschedules cleanly after cancel()', () => {
    const fn = vi.fn();
    const scheduled = coalesceFrame(fn);

    scheduled();
    scheduled.cancel();
    scheduled();
    flushFrame();

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
