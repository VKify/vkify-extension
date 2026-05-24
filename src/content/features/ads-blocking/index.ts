/**
 * Ads-blocking feature registration.
 *
 * Wires together three independent sub-modules and registers them with the
 * FeatureManager under their respective settings keys.
 *
 *   block_left_ads      — inline CSS that hides sidebar ad widgets
 *   block_feed_ads_api  — fetch interceptor (injected script, network-level)
 *   block_feed_ads_dom  — CSS + MutationObserver + JS heuristics (DOM-level)
 *   block_trackers      — tracker network interceptor + DOM cleanup
 *
 * All sub-modules share a single stats/listener context created here.
 */

import type { FeatureManager } from '../../core/feature-manager.js';
import { createSharedContext }  from './shared.js';
import { createFeedApiBlocker } from './feed-api.js';
import { createFeedDomBlocker } from './feed-dom.js';
import { createTrackerBlocker } from './trackers.js';

export function registerAdsBlockingFeatures(manager: FeatureManager): { forceScan: () => void } {
  const shared = createSharedContext();

  // Initialise custom filter words from storage
  void chrome.storage.local
    .get(['custom_block_words', 'custom_allow_words'])
    .then(data => {
      shared.customWords.block = (data['custom_block_words'] as string[]) || [];
      shared.customWords.allow = (data['custom_allow_words'] as string[]) || [];
    })
    .catch(() => {});

  // Keep custom words + in-memory stats counters in sync with the popup
  chrome.storage.onChanged.addListener((changes, area) => shared.onStorageChange(changes, area));

  const feedApi  = createFeedApiBlocker(manager, shared);
  const feedDom  = createFeedDomBlocker(manager, shared);
  const trackers = createTrackerBlocker(manager, shared);

  manager.registerMultiple({
    block_left_ads: {
      reapplyOnNavigate: true,
      enable: () => {
        manager.injectCSS('block_left_ads', `
          #ads_wrapper,
          [id*="ads_"],
          [class*="ads_"] {
            display: none !important;
          }
        `);
      },
      disable: () => manager.removeCSS('block_left_ads'),
    },

    block_feed_ads_api: { reapplyOnNavigate: true, enable: feedApi.enable,  disable: feedApi.disable  },
    block_feed_ads_dom: { reapplyOnNavigate: true, enable: feedDom.enable,  disable: feedDom.disable  },

    block_trackers: {
      enable:  trackers.enable,
      disable: trackers.disable,
    },
  });

  return { forceScan: feedDom.forceScan };
}
