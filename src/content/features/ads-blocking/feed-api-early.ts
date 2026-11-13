import { ScriptInjector } from '../../core/script-injector.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import { dispatchPageEvent } from '../../utils/page-event.js';
import { shouldEnable } from '../../core/should-enable.js';

/** Start at document_start with stored flags, including when all optional filters are off. */
export function startFeedApiEarly(): void {
  const keys = ['block_feed_ads_api', 'block_yandex_browser_promo', 'block_recommendations_feed', 'block_recommendations_profile'];
  void (async () => {
    const initial = await chrome.storage.local.get([...keys, 'custom_block_words', 'custom_allow_words']);
    const seed = { ...initial, block_feed_ads_api: shouldEnable(initial.block_feed_ads_api ?? true),
      block_yandex_browser_promo: initial.block_yandex_browser_promo !== false,
      block_recommendations_feed: initial.block_recommendations_feed !== false,
      block_recommendations_profile: initial.block_recommendations_profile !== false };
    const ready = waitForInjectedScript(InjectedScript.FEED_AD_BLOCKER);
    new ScriptInjector().inject(InjectedScript.FEED_AD_BLOCKER, undefined, seed);
    await ready;
    // Re-read because the user may have disabled the setting during injection.
    const latest = await chrome.storage.local.get([...keys, 'custom_block_words', 'custom_allow_words']);
    dispatchPageEvent('vkify-update-settings', {
      block_recommendations_profile: latest.block_recommendations_profile !== false,
      block_feed_ads_api: shouldEnable(latest.block_feed_ads_api ?? true),
      block_yandex_browser_promo: latest.block_yandex_browser_promo !== false,
      block_recommendations_feed: latest.block_recommendations_feed !== false,
      custom_block_words: latest.custom_block_words ?? [],
      custom_allow_words: latest.custom_allow_words ?? [],
    });
  })().catch(() => { /* Normal feature initialization can retry. */ });
}
