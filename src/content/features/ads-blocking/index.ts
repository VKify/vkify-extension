/**
 * Ads-blocking feature registration.
 *
 * Wires together three independent sub-modules and registers them with the
 * FeatureManager under their respective settings keys.
 *
 *   block_left_ads      — inline CSS that hides sidebar ad widgets
 *   block_feed_ads_api  — fetch interceptor (injected script, network-level)
 *   block_feed_ads_dom  — optional user keyword filter (DOM-level)
 *   block_trackers      — tracker network interceptor + DOM cleanup
 *
 * All sub-modules share a single stats/listener context created here.
 */

import { recommendationFeatures } from './recommendations/index.js';
import type { FeatureManager } from '../../core/feature-manager.js';
import { cssFeature, cssPlugin, handlerFeature } from '../../core/features/index.js';
import { createSharedContext }  from './shared.js';
import { createFeedApiBlocker } from './feed-api.js';
import { createFeedDomBlocker } from './feed-dom.js';
import { createTrackerBlocker } from './trackers.js';

export function registerAdsBlockingFeatures(manager: FeatureManager): { forceScan: () => void } {
  manager.registerDefinitions(recommendationFeatures);
  const shared = createSharedContext();

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

  // Keep custom words + in-memory stats counters in sync with the popup
  chrome.storage.onChanged.addListener((changes, area) => {
    shared.onStorageChange(changes, area);
    if (area !== 'local') return;
    const keys = wordKeys.filter(key => key in changes);
    keys.forEach(key => changedWordKeys.add(key));
    if (keys.length) updateWords();
  });

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

  // Перехватчики (fetch/DOM/трекеры) — императивные ядра не тронуты,
  // оборачиваются handlerFeature с метадатой на месте.
  manager.registerDefinitions([
    handlerFeature({
      id: 'block_music_ads',
      name: 'Реклама и рекомендации: music', category: 'ads', impact: 'light',
      phase: 'early-css', enabledByDefault: true,
      cssFiles: ['ads-blocking/recommendations/music.css'],
      tags: ['css-marker', 'network', 'music', 'injected-script'],
      plugins: [cssPlugin(['ads-blocking/recommendations/music.css'])],
      handler: { enable: trackers.enableMusicAds, disable: trackers.disableMusicAds },
    }),
    handlerFeature({
      id: 'block_feed_ads_api',
      name: 'Реклама в ленте (API)', category: 'ads', impact: 'medium',
      initOrder: 50, tags: ['network', 'feed', 'injected-script'],
      reapplyOnNavigate: true,
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
