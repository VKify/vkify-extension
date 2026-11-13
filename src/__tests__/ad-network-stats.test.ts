// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSharedContext, type SharedContext } from '../content/features/ads-blocking/shared.js';
import { BLOCK_STATS_SECTIONS } from '../shared/block-stats.js';
const send = vi.fn(async (_message: { entries: { detail?: string }[] }) => ({ success: true }));
let context: SharedContext;
beforeEach(() => {
  send.mockClear(); vi.stubGlobal('chrome', { runtime: { sendMessage: send } });
  context = createSharedContext(); context.start();
});
afterEach(() => { context.stop(); vi.unstubAllGlobals(); });
const emit = (detail: unknown) => window.dispatchEvent(new CustomEvent('vkify:blocked', { detail }));
it.each(BLOCK_STATS_SECTIONS)('accepts the section %s without relying on another enabled filter', section => {
  context.start();
  emit({ kind: section === 'block_trackers' ? 'tracker' : 'ad', domain: 'VK API', method: 'api', section, detail: 'Banner', trigger: 'Reason', payload: '{}' });
  expect(send).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith({ type: 'RECORD_BLOCK_STATS', entries: [expect.objectContaining({ section, trigger: 'Reason', payload: '{}' })] });
});
it('rejects malformed payloads and does not treat visible DOM content as a block', () => {
  document.body.innerHTML = '<section><a href="https://vk.ru/vkpremium">Premium</a><ins data-ad-slot="1"></ins></section>';
  for (const value of [null, {}, { kind: 'ad', domain: 'VK', section: 'invalid' }, { kind: 'ad', domain: 'VK', payload: 'x'.repeat(4097) }]) emit(value);
  expect(send).not.toHaveBeenCalled();
  context.stop();
  emit({ kind: 'ad', domain: 'VK' });
  expect(send).not.toHaveBeenCalled();
});
it('keeps network metadata and accepts long request URLs without dropping the block', () => {
  emit({ kind: 'tracker', domain: 'tracker.test', url: 'https://tracker.test/?token=' + 'x'.repeat(3000), method: 'network' });
  expect(send).toHaveBeenCalledWith({ type: 'RECORD_BLOCK_STATS', entries: [expect.objectContaining({ kind: 'tracker', method: 'network', section: 'block_trackers', detail: expect.any(String) })] });
  expect(send.mock.calls[0][0].entries[0].detail!.length).toBeLessThanOrEqual(500);
});

it('does not silently drop a large legitimate feed response', () => {
  for (let i = 0; i < 350; i++) emit({ kind: 'ad', domain: 'VK API', section: 'block_feed_ads_api', method: 'api' });
  expect(send).toHaveBeenCalledTimes(350);
});
