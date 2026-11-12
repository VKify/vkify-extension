import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';
import { suppressFeedNoticeFlags } from './feed-notice-flags.js';
import { feedItemText, matchFeedWord, normalizeFeedWords, type FeedKeywords } from '../../shared/utils/feed-keywords.js';
import { createFeedDiscovery, hasFeedShape, isFeedCandidate, readFeedProbe, vkApiMethod } from './feed-discovery.js';
import { buildBlockedFeedLog, blockedFeedDescription } from '../../shared/utils/blocked-feed-log.js';
import { removeFeaturedGamePromo } from './feed-right-block.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor) return;
  (window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor = true;

  const FEED_METHODS = new Set([
    'newsfeed.get', 'newsfeed.getFeed', 'newsfeed.getRecommended',
    'newsfeed.getMulti', 'newsfeed.getFeedExp', 'wall.get',
    'owners.getMainTab', 'search.getSearchAllWeb2',
  ]);
  const diagnosticLog: Array<{ method: string; reason: string }> = [];
  const discovery = createFeedDiscovery(entry => {
    diagnosticLog.push(entry);
    window.dispatchEvent(new CustomEvent('vkify:feed-diagnostic', { detail: { ...entry } }));
  });
  const diagnosticSnapshot = () => diagnosticLog.map(entry => ({ ...entry }));
  try {
    Object.defineProperty(window, '__vkifyFeedDiagnostics', { configurable: true, get: diagnosticSnapshot });
  } catch { /* A page-owned property must not prevent filtering. Events remain available. */ }
  let lastFeed: { method: string; time: number } | undefined;

  const AD_ITEM_TYPES = [
    'ads', 'ads_easy_promote', 'ads_post',
    'ads_app', 'ads_site', 'ads_vk_apps_slider',
  ];

  const AD_ITEM_FLAGS = ['marked_as_ads', 'is_ad', 'ad_id'];
  // Feed game promotions are recommendation items, without the usual ad flags.
  const GAME_PROMO_TYPES = new Set(['recommended_game', 'recommended_games_carousel']);

  // In-memory flag — set via vkify-update-settings event. Never stored in localStorage:
  // localStorage is VK-page-readable and exposes the extension's presence to the site.
  let blockFeedAds = false;
  let blockBrowserPromo = false;
  let blockFeedRecommendations = false;
  const restoreNoticeFlags = suppressFeedNoticeFlags(window, () => true, {
    feed: () => blockBrowserPromo, menu: () => blockBrowserPromo,
  });
  const customWords: FeedKeywords = { block: [], allow: [] };

  interface FeedItem {
    type?: string;
    marked_as_ads?: unknown;
    is_ad?: unknown;
    ad_id?: unknown;
    [key: string]: unknown;
  }

  function isAdItem(item: unknown): boolean {
    if (!item || typeof item !== 'object') return false;
    const fi = item as FeedItem;
    const type = fi.type || '';
    if (typeof type === 'string' && GAME_PROMO_TYPES.has(type)) return true;
    if (typeof type === 'string' && AD_ITEM_TYPES.some(t => type.startsWith(t))) return true;
    if (fi.post_type === 'post_ads') return true;
    if (AD_ITEM_FLAGS.some(f => fi[f])) return true;
    return false;
  }

  interface FeedApiResponse {
    response?: {
      groups?: unknown[];
      profiles?: unknown[];
      items?: FeedItem[];
      sections?: Array<{ items?: Array<{ id?: string }> }> | Record<string, { items?: Array<{ id?: string }> }>;
      ads?: unknown[];
      ad_posts?: unknown[];
      feed_ids?: unknown[];
      newsfeed_items?: Array<{ id?: unknown; item?: FeedItem }>;
      catalog?: { sections?: Array<{ blocks?: Array<{ newsfeed_item_ids?: unknown[] }> }> };
    };
  }

  function filterFeedResponse(data: FeedApiResponse, url: string, apiMethod: string): boolean {
    if (!data?.response || typeof data.response !== 'object') return false;

    const blocked: Array<{ item: FeedItem; word: string | null }> = [];
    const keepItem = (item: FeedItem): boolean => {
      const word = customWords.block.length ? matchFeedWord(feedItemText(item), customWords) : null;
      if (isAdItem(item) || word) { blocked.push({ item, word }); return false; }
      return true;
    };
    if (Array.isArray(data.response.items)) data.response.items = data.response.items.filter(keepItem);

    // Search uses an entity table and catalog references rather than response.items.
    const removedSearchIds = new Set<string>();
    if (Array.isArray(data.response.newsfeed_items)) {
      data.response.newsfeed_items = data.response.newsfeed_items.filter(entry => {
        if (!entry?.item || typeof entry.item !== 'object') return true;
        if (keepItem(entry.item)) return true;
        if (typeof entry.id === 'string') removedSearchIds.add(entry.id);
        return false;
      });
    }
    if (removedSearchIds.size && Array.isArray(data.response.catalog?.sections)) {
      for (const section of data.response.catalog.sections) {
        if (!Array.isArray(section?.blocks)) continue;
        for (const block of section.blocks) {
          if (!Array.isArray(block?.newsfeed_item_ids)) continue;
          block.newsfeed_item_ids = block.newsfeed_item_ids.filter(id =>
            typeof id !== 'string' || !removedSearchIds.has(id));
        }
      }
    }

    if (blocked.length > 0) {
      console.log('[VKify/FetchBlock] Filtered ' + blocked.length + ' ad(s) from API response');
      blocked.forEach(({ item, word }) => {
        const adType = item.post_type === 'post_ads' ? 'post_ads' : (item.type as string) || 'ads';
        const snapshot = buildBlockedFeedLog(item, apiMethod, data.response);
        let payload: string | undefined;
        try { payload = JSON.stringify(snapshot); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('vkify:blocked', {
          detail: {
            kind: 'ad',
            method: 'api',
            domain: 'VK API',
            url,
            detail: blockedFeedDescription(snapshot),
            trigger: word ? `keyword: ${word.slice(0, 400)}` : adType,
            payload,
          },
        }));
      });
    }

    let changed = blocked.length > 0;
    if (data.response.ads) {
      changed ||= !Array.isArray(data.response.ads) || data.response.ads.length > 0;
      data.response.ads = [];
    }
    if (data.response.ad_posts) {
      changed ||= !Array.isArray(data.response.ad_posts) || data.response.ad_posts.length > 0;
      data.response.ad_posts = [];
    }

    if (Array.isArray(data.response.feed_ids)) {
      const previous = data.response.feed_ids;
      data.response.feed_ids = previous.filter(id => {
        if (typeof id === 'string') {
          return !AD_ITEM_TYPES.some(t => id.startsWith(t));
        }
        return true;
      });
      changed ||= previous.length !== data.response.feed_ids.length;
    }

    return changed;
  }

  function filterMenu(data: FeedApiResponse): void {
    const sections = data?.response?.sections;
    if (!sections || typeof sections !== 'object') return;
    for (const section of Object.values(sections)) {
      if (Array.isArray(section?.items)) section.items = section.items.filter(item =>
        item?.id !== 'l_invite_menu_promo' && item?.id !== 'l_invite_promo');
    }
  }

  function filterRightBlock(data: unknown): boolean {
    const block = removeFeaturedGamePromo(data);
    if (!block) return false;
    const title = typeof block.title === 'string' ? block.title.slice(0, 300) : 'Игровой промоблок в ленте';
    window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', method: 'api', domain: 'VK API', url: '/method/newsfeed.getRightBlock',
      section: 'block_recommendations_feed', detail: title, trigger: 'frb_featured_promo_game',
      payload: JSON.stringify({ api_method: 'newsfeed.getRightBlock', frb_type: 'frb_featured_promo_game', title }),
    } }));
    return true;
  }

  const unregisterFetchHook = registerResponseHook(async (url, response) => {
    if (!blockFeedAds && !blockBrowserPromo && !blockFeedRecommendations) return response;
    const method = vkApiMethod(url, location.href);
    if (!method) return response;
    const menu = blockBrowserPromo && method === 'internal.getWebLeftMenu';
    const rightBlock = blockFeedRecommendations && method === 'newsfeed.getRightBlock';
    const known = blockFeedAds && FEED_METHODS.has(method);
    const mode = !menu && !rightBlock && !known && blockFeedAds && response.ok &&
      /^application\/(?:[\w.+-]+\+)?json\b/i.test(response.headers.get('content-type') ?? '')
      ? discovery.consider(method) : null;
    if (!menu && !rightBlock && !known && !mode) return response;
    if (!menu && !rightBlock) lastFeed = { method, time: Date.now() };

    try {
      const data = (mode === 'probe' ? await readFeedProbe(response) : await response.clone().json()) as FeedApiResponse;
      // Recheck after awaiting: disabling protection must take effect in-flight too.
      if (menu ? !blockBrowserPromo : rightBlock ? !blockFeedRecommendations : !blockFeedAds) return response;
      if (mode && (data === undefined || !discovery.inspect(method, data))) {
        if (data === undefined) discovery.report(method, 'probe-limit-or-invalid-json');
        return response;
      }
      if (menu) filterMenu(data);
      else if (rightBlock) { if (!filterRightBlock(data)) return response; }
      else if (!filterFeedResponse(data, known ? url : '/method/' + method, method)) return response;

      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      if (mode) discovery.inspect(method, undefined);
      return response;
    }
  });

  const restorePrefetch = interceptFeedPrefetch(window, entry => {
    if (blockBrowserPromo && entry.method === 'internal.getWebLeftMenu') filterMenu(entry as FeedApiResponse);
    if (blockFeedRecommendations && entry.method === 'newsfeed.getRightBlock') filterRightBlock(entry);
    if (!blockFeedAds) return;
    const method = vkApiMethod('/method/' + entry.method, location.href);
    if (!method) return;
    // An old/incomplete cache entry must not suppress probing a fresh response.
    if (FEED_METHODS.has(method) || ((isFeedCandidate(method) || hasFeedShape(entry, true)) && discovery.inspect(method, entry, false))) {
      lastFeed = { method, time: Date.now() };
      filterFeedResponse(entry as FeedApiResponse, location.href, method);
    }
  });

  const handleSettingsUpdate = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;

    if ('custom_block_words' in detail) customWords.block = normalizeFeedWords(detail.custom_block_words);
    if ('custom_allow_words' in detail) customWords.allow = normalizeFeedWords(detail.custom_allow_words);
    if (typeof detail.block_yandex_browser_promo === 'boolean') blockBrowserPromo = detail.block_yandex_browser_promo;
    if (typeof detail.block_recommendations_feed === 'boolean') blockFeedRecommendations = detail.block_recommendations_feed;

    if (typeof detail.block_feed_ads_api === 'boolean') {
      blockFeedAds = detail.block_feed_ads_api;
      console.log('[VKify/FetchBlock] ' + (blockFeedAds ? 'Activated' : 'Deactivated'));
    }
    // Settings and word-list changes also apply to an existing prefetch cache.
    if (blockFeedAds || blockBrowserPromo || blockFeedRecommendations) {
      const cur = Reflect.get(window, 'cur');
      if (cur && typeof cur === 'object') Reflect.get(cur, 'apiPrefetchCache');
    }
  };
  window.addEventListener('vkify-update-settings', handleSettingsUpdate);
  const domFallback = () => {
    if (blockFeedAds) discovery.report(lastFeed && Date.now() - lastFeed.time < 10_000 ? lastFeed.method : 'unknown', 'dom-fallback-after-recent-request');
  };
  window.addEventListener('vkify:feed-dom-fallback', domFallback);

  const handleDestroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    unregisterFetchHook();
    restorePrefetch();
    restoreNoticeFlags();
    window.removeEventListener('vkify-update-settings', handleSettingsUpdate);
    window.removeEventListener('vkify:feed-dom-fallback', domFallback);
    window.removeEventListener('message', handleDestroy);
    blockFeedAds = false;
    blockFeedRecommendations = false;
    if (Object.getOwnPropertyDescriptor(window, '__vkifyFeedDiagnostics')?.get === diagnosticSnapshot)
      Reflect.deleteProperty(window, '__vkifyFeedDiagnostics');
    delete (window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor;
  };
  window.addEventListener('message', handleDestroy);

  console.log('[VKify/FetchBlock] Interceptor loaded');

  // Сигнализируем контентному скрипту, что мы готовы принимать события.
  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'feed-ad-blocker' },
  }));
})();
