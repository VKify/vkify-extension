// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSharedContext, type SharedContext } from '../features/ads-blocking/shared.js';
import { dispatchPageEvent } from '../utils/page-event.js';

let collector: SharedContext;
const send = vi.fn(async () => ({ success: true }));
beforeEach(() => {
  vi.resetModules(); send.mockClear();
  vi.stubGlobal('chrome', { runtime: { sendMessage: send } });
  collector = createSharedContext();
});
afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', { source: window, data: { type: 'VKIFY_DESTROY' } }));
  collector.stop(); vi.unstubAllGlobals();
});
const report = () => dispatchPageEvent('vkify:blocked', { kind: 'tracker', domain: 'mc.yandex.ru', method: 'network' });

it('delivers early results exactly once when the collector starts later', async () => {
  await import('./protection-stats-relay.js');
  report(); report();
  expect(send).not.toHaveBeenCalled();
  collector.start();
  expect(send).toHaveBeenCalledTimes(2);
  collector.start();
  report();
  expect(send).toHaveBeenCalledTimes(3);
});

it('does not replay results already received by an earlier collector', async () => {
  collector.start();
  await import('./protection-stats-relay.js');
  report();
  collector.stop(); collector.start();
  expect(send).toHaveBeenCalledOnce();
  collector.stop();
  report();
  collector.start();
  expect(send).toHaveBeenCalledTimes(2);
});
