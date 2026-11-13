/**
 * Ads-blocking feature registration.
 *
 * Wires together three independent sub-modules and registers them with the
 * FeatureManager under their respective settings keys.
 *
 *   block_left_ads      — native loader guard and API creative filtering
 *   block_feed_ads_api  — fetch interceptor (injected script, network-level)
 *   block_feed_ads_dom  — optional user keyword filter (DOM-level)
 *   block_trackers      — tracker network interceptor + DOM cleanup
 *
 * All sub-modules share the context subscribed at document_start.
 */

import { catalogApiFeature } from '../hiding/catalog-api-feature.js';
import { createRecommendationFeatures } from './recommendations/index.js';
import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { getAdsBlockingContext }  from './shared.js';
import { createFeedApiBlocker } from './feed-api.js';
import { createFeedDomBlocker } from './feed-dom.js';
import { createTrackerBlocker } from './trackers.js';
import { createAdStatsWidget } from './stats-widget.js';

export function registerAdsBlockingFeatures(manager: FeatureManager): { forceScan: () => void } {
  const shared = getAdsBlockingContext();
  manager.registerDefinitions(createRecommendationFeatures(shared, manager));

  const feedApi  = createFeedApiBlocker(manager, shared);
  const feedDom  = createFeedDomBlocker(manager, shared);
  const trackers = createTrackerBlocker(manager, shared);
  const changedWordKeys = new Set<string>();
  const wordKeys = ['custom_block_words', 'custom_allow_words'];

  function updateWords(): void {
    feedApi.updateWords();
    feedDom.forceScan();
  }

  // Initialise words without overwriting a newer storage event.
  void chrome.storage.local
    .get(['custom_block_words', 'custom_allow_words'])
    .then(data => {
      const changes = Object.fromEntries(wordKeys.filter(key => !changedWordKeys.has(key))
        .map(key => [key, { newValue: data[key] }]));
      shared.onStorageChange(changes, 'local');
      updateWords();
    })
    .catch(() => {});

  // Keep custom filter words in sync with the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    shared.onStorageChange(changes, area);
    if (area !== 'local') return;
    const keys = wordKeys.filter(key => key in changes);
    keys.forEach(key => changedWordKeys.add(key));
    if (keys.length) updateWords();
  });

  manager.registerDefinition(catalogApiFeature('block_left_ads', 'Реклама слева', 'ads'));

  // Перехватчики (fetch/DOM/трекеры) — императивные ядра не тронуты,
  // оборачиваются handlerFeature с метадатой на месте.
  manager.registerDefinitions([
    handlerFeature({
      id: 'block_recommendations_video', name: 'Реклама и рекомендации: video', category: 'ads', impact: 'light',
      phase: 'early-css', enabledByDefault: true,
      tags: ['network', 'video', 'injected-script'],
      handler: {
        enable: () => { trackers.enableVideoAds(); },
        disable: () => { trackers.disableVideoAds(); },
      },
    }),
    handlerFeature({
      id: 'ad_stats_widget', name: 'Мини-виджет блокировки рекламы', category: 'ads',
      impact: 'light', requiresDomLayer: true, initOrder: 90,
      tags: ['widget', 'floating', 'stats'], handler: createAdStatsWidget(manager),
    }),
    handlerFeature({
      id: 'block_music_ads',
      name: 'Реклама и рекомендации: music', category: 'ads', impact: 'light',
      phase: 'early-css', enabledByDefault: true,
      tags: ['network', 'music', 'injected-script'],
      handler: {
        enable: () => { trackers.enableMusicAds(); },
        disable: () => { trackers.disableMusicAds(); },
      },
    }),
    handlerFeature({
      id: 'block_feed_ads_api',
      name: 'Реклама в ленте (API)', category: 'ads', impact: 'medium',
      initOrder: 50, tags: ['network', 'feed', 'injected-script'],
      // The page-wide interceptor survives SPA navigation and needs no reapplication.
      handler: { enable: feedApi.enable, disable: feedApi.disable },
    }),
    handlerFeature({
      id: 'block_feed_ads_dom',
      name: 'Реклама в ленте (DOM)', category: 'ads', impact: 'heavy',
      requiresDomLayer: true, initOrder: 60, tags: ['dom', 'observer', 'feed'],
      reapplyOnNavigate: true,
      handler: { enable: feedDom.enable, disable: feedDom.disable },
    }),
    handlerFeature({
      id: 'block_trackers',
      name: 'Блокировка трекеров', category: 'privacy', impact: 'medium',
      initOrder: 20, tags: ['network', 'privacy'],
      handler: { enable: trackers.enable, disable: trackers.disable },
    }),
  ]);

  return { forceScan: feedDom.forceScan };
}
