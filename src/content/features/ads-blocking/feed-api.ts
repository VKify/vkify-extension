/**
 * API-level feed-ad blocker.
 *
 * Injects `feed-ad-blocker.ts` into the page context, which patches
 * `window.fetch` and the HTML-embedded `cur.apiPrefetchCache` to strip ad items
 * from VK newsfeed API responses. Initial startup also runs from document_start
 * via feed-api-early.ts, before the normal feature lifecycle begins.
 */

import type { FeatureContext } from '../../core/feature-context.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import type { SharedContext } from './shared.js';

export interface FeedApiBlocker {
  enable(): void;
  disable(): void;
  updateWords(): void;
}

export function createFeedApiBlocker(
  ctx:    FeatureContext,
  shared: SharedContext,
): FeedApiBlocker {
  let isEnabled = false;

  function enable(): void {
    if (isEnabled) return;
    isEnabled = true;

    void shared.loadStats();
    shared.addListenerUser();

    const ready = waitForInjectedScript(InjectedScript.FEED_AD_BLOCKER);
    ctx.injectScript(InjectedScript.FEED_AD_BLOCKER);
    ready.then(() => {
      if (isEnabled) ctx.sendEvent('vkify-update-settings', {
        block_feed_ads_api: true,
        custom_block_words: shared.customWords.block,
        custom_allow_words: shared.customWords.allow,
      });
    });

    console.log('[AdBlocker/API] Enabled (fetch interceptor)');
  }

  function disable(): void {
    if (!isEnabled) return;
    isEnabled = false;

    ctx.sendEvent('vkify-update-settings', { block_feed_ads_api: false });
    shared.releaseListenerUser();

    console.log('[AdBlocker/API] Disabled');
  }

  function updateWords(): void {
    if (!isEnabled) return;
    ctx.sendEvent('vkify-update-settings', {
      custom_block_words: shared.customWords.block,
      custom_allow_words: shared.customWords.allow,
    });
  }

  return { enable, disable, updateWords };
}
