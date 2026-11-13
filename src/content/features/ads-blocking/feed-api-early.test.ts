// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { ScriptInjector } from '../../core/script-injector.js';
import { startFeedApiEarly } from './feed-api-early.js';
import { dispatchPageEvent } from '../../utils/page-event.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([true, false, undefined])('installs stored filters (%s) with the script and reconciles a change made while loading', async enabled => {
  let finishRead!: (settings: object) => void;
  const get = vi.fn()
    .mockResolvedValueOnce({ block_feed_ads_api: enabled, custom_block_words: ['spam'] })
    .mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  vi.stubGlobal('chrome', { storage: { local: { get } } });
  const inject = vi.spyOn(ScriptInjector.prototype, 'inject').mockImplementation(name => {
    dispatchPageEvent('vkify-script-ready', { name });
  });
  const received: unknown[] = [];
  const listener = (event: Event) => received.push((event as CustomEvent).detail);
  window.addEventListener('vkify-update-settings', listener);
  try {
    startFeedApiEarly();
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(inject).toHaveBeenCalledWith('feed-ad-blocker', undefined, expect.objectContaining({
      block_feed_ads_api: enabled !== false, block_yandex_browser_promo: true,
      block_recommendations_feed: true, block_recommendations_profile: true,
      custom_block_words: ['spam'],
    }));
    expect(received).toEqual([]);
    finishRead({ block_feed_ads_api: false, block_yandex_browser_promo: false });
    await vi.waitFor(() => expect(received).toContainEqual(expect.objectContaining({
      block_feed_ads_api: false, block_yandex_browser_promo: false,
    })));
  } finally { window.removeEventListener('vkify-update-settings', listener); }
});
