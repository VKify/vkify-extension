import { ScriptInjector } from '../../core/script-injector.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import { dispatchPageEvent } from '../../utils/page-event.js';
import { shouldEnable } from '../../core/should-enable.js';

/** Start feed filtering and browser-promo guards before VK consumes boot config/cache. */
export function startFeedApiEarly(): void {
  const keys = ['block_feed_ads_api', 'block_yandex_browser_promo'];
  void chrome.storage.local.get(keys).then(async settings => {
    if (!shouldEnable(settings.block_feed_ads_api) && settings.block_yandex_browser_promo === false) return;
    const ready = waitForInjectedScript(InjectedScript.FEED_AD_BLOCKER);
    new ScriptInjector().inject(InjectedScript.FEED_AD_BLOCKER);
    await ready;
    // Re-read because the user may have disabled the setting during injection.
    const latest = await chrome.storage.local.get([...keys, 'custom_block_words', 'custom_allow_words']);
    dispatchPageEvent('vkify-update-settings', {
      block_feed_ads_api: shouldEnable(latest.block_feed_ads_api),
      block_yandex_browser_promo: latest.block_yandex_browser_promo !== false,
      custom_block_words: latest.custom_block_words ?? [],
      custom_allow_words: latest.custom_allow_words ?? [],
    });
  }).catch(() => { /* Normal feature initialization can retry. */ });
}
