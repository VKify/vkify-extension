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
import { cssFeature } from '../../core/features/index.js';
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

  // Статический CSS (block-left-ads.css) — декларативная фича (новый API):
  // маркер data-vkify-block_left_ads ставит/снимает фреймворк, метадата здесь же.
  manager.registerDefinition(cssFeature({
    id: 'block_left_ads',
    name: 'Скрыть рекламу слева',
    category: 'ads',
    cssFiles: 'ads-blocking/block-left-ads.css',
    initOrder: 10,
    tags: ['css-marker'],
  }));

  // Перехватчики (fetch/DOM/трекеры) — на плагинах через адаптер handlerPlugin
  // (логика не тронута; reapplyOnNavigate переносится на определение).
  manager.registerHandlerMap({
    block_feed_ads_api: { reapplyOnNavigate: true, enable: feedApi.enable,  disable: feedApi.disable  },
    block_feed_ads_dom: { reapplyOnNavigate: true, enable: feedDom.enable,  disable: feedDom.disable  },

    block_trackers: {
      enable:  trackers.enable,
      disable: trackers.disable,
    },
  });

  manager.describeFeatures({
    // block_left_ads — декларативная фича (новый API), метадата в registerDefinition выше.
    block_feed_ads_api: {
      name: 'Реклама в ленте (API)', category: 'ads', impact: 'medium',
      initOrder: 50, tags: ['network', 'feed', 'injected-script'],
    },
    block_feed_ads_dom: {
      name: 'Реклама в ленте (DOM)', category: 'ads', impact: 'heavy',
      requiresDomLayer: true, initOrder: 60, tags: ['dom', 'observer', 'feed'],
    },
    block_trackers: {
      name: 'Блокировка трекеров', category: 'privacy', impact: 'medium',
      initOrder: 20, tags: ['network', 'privacy'],
    },
  });

  return { forceScan: feedDom.forceScan };
}
