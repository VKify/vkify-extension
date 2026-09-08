import { ScriptInjector } from '../../core/script-injector.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import { dispatchPageEvent } from '../../utils/page-event.js';
import { shouldEnable } from '../../core/should-enable.js';

/** Start before DOMContentLoaded: VK consumes its inline API cache during boot. */
export function startFeedApiEarly(): void {
  void chrome.storage.local.get('block_feed_ads_api').then(async settings => {
    if (!shouldEnable(settings.block_feed_ads_api)) return;
    const ready = waitForInjectedScript(InjectedScript.FEED_AD_BLOCKER);
    new ScriptInjector().inject(InjectedScript.FEED_AD_BLOCKER);
    await ready;
    // Re-read because the user may have disabled the setting during injection.
    const latest = await chrome.storage.local.get(['block_feed_ads_api', 'custom_block_words', 'custom_allow_words']);
    dispatchPageEvent('vkify-update-settings', {
      block_feed_ads_api: shouldEnable(latest.block_feed_ads_api),
      custom_block_words: latest.custom_block_words ?? [],
      custom_allow_words: latest.custom_allow_words ?? [],
    });
  }).catch(() => { /* Normal feature initialization can retry. */ });
}
