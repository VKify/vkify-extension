/**
 * API-level feed-ad blocker.
 *
 * Injects `ad-feed-blocker.ts` into the page context, which patches
 * `window.fetch` to strip ad items from VK newsfeed API responses before
 * they reach the React renderer. Zero DOM mutations — the posts are filtered
 * out at the network layer.
 */

import type { FeatureContext } from '../../core/feature-context.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import type { SharedContext } from './shared.js';

export interface FeedApiBlocker {
  enable(): void;
  disable(): void;
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

    ctx.injectScript(InjectedScript.AD_FEED_BLOCKER);
    waitForInjectedScript(InjectedScript.AD_FEED_BLOCKER).then(() => {
      ctx.sendEvent('vkify-update-settings', { block_feed_ads_api: true });
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

  return { enable, disable };
}
