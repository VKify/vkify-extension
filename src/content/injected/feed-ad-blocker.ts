import { readInitialSettings } from './initial-settings.js';
import { filterMessengerBrowserPromo, installMessengerBrowserPromo } from './messenger-browser-promo.js';
import { registerRequestHook, registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';
import { suppressFeedNoticeFlags } from './feed-notice-flags.js';
import { feedItemText, matchFeedWord, normalizeFeedWords, type FeedKeywords } from '../../shared/utils/feed-keywords.js';
import { createFeedDiscovery, hasFeedShape, isFeedCandidate, readFeedProbe, vkApiMethod } from './feed-discovery.js';
import { buildBlockedFeedLog, blockedFeedDescription } from '../../shared/utils/blocked-feed-log.js';
import { removeFeedRightPromo } from './feed-right-block.js';
import { installLegacyFeedRight } from './feed-right-legacy.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor) return;
  (window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor = true;

  const FEED_METHODS = new Set([
    'newsfeed.get', 'newsfeed.getFeed', 'newsfeed.getRecommended',
    'newsfeed.getMulti', 'newsfeed.getFeedExp', 'newsfeed.getByType', 'wall.get',
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

  const AD_ITEM_TYPES = [
    'ads', 'ads_easy_promote', 'ads_post',
    'ads_app', 'ads_site', 'ads_vk_apps_slider',
  ];

  const AD_ITEM_FLAGS = ['marked_as_ads', 'is_ad', 'ad_id'];
  // Feed game promotions are recommendation items, without the usual ad flags.
  const GAME_PROMO_TYPES = new Set(['recommended_game', 'recommended_games_carousel']);
  // The request filter is videos_for_you_block; VK returns an async videos_for_you item.
  const RECOMMENDATION_TYPES = new Set(['recommended_groups', 'recommended_channels', 'videos_for_you', ...GAME_PROMO_TYPES]);

  // In-memory flag — set via vkify-update-settings event. Never stored in localStorage:
  // localStorage is VK-page-readable and exposes the extension's presence to the site.
  const initial = readInitialSettings();
  let blockFeedAds = initial.block_feed_ads_api === true;
  let blockBrowserPromo = initial.block_yandex_browser_promo === true;
  let blockProfileAds = initial.block_recommendations_profile === true;
  const reportMessengerPromo = () => window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
    kind: 'ad', domain: 'VK API · Мессенджер', method: 'api', section: 'block_yandex_browser_promo',
    detail: 'Яндекс Браузер · баннер над диалогами', trigger: 'yandex_promo',
  } }));
  const stopMessengerPromo = installMessengerBrowserPromo(() => blockBrowserPromo, reportMessengerPromo);
  let blockFeedRecommendations = initial.block_recommendations_feed === true;
  const stopLegacyFeedRight = installLegacyFeedRight(() => blockFeedRecommendations, title => {
    window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', method: 'api', domain: 'VK API', section: 'block_recommendations_feed',
      url: '/al_feed_right_block.php', detail: title, trigger: 'featured_promo_game',
    } }));
  });
  const restoreNoticeFlags = suppressFeedNoticeFlags(window, () => true, {
    feed: () => blockBrowserPromo, menu: () => blockBrowserPromo,
  }, () => blockProfileAds);
  const customWords: FeedKeywords = { block: normalizeFeedWords(initial.custom_block_words), allow: normalizeFeedWords(initial.custom_allow_words) };

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

    const blocked: Array<{ item: FeedItem; word: string | null; recommendation: boolean }> = [];
    const keepItem = (item: FeedItem): boolean => {
      if (!item || typeof item !== 'object') return true;
      const recommendation = blockFeedRecommendations && RECOMMENDATION_TYPES.has(item.type ?? '');
      const word = blockFeedAds && customWords.block.length ? matchFeedWord(feedItemText(item), customWords) : null;
      if (recommendation || (blockFeedAds && isAdItem(item)) || word) { blocked.push({ item, word, recommendation }); return false; }
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
      blocked.forEach(({ item, word, recommendation }) => {
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
            section: recommendation ? 'block_recommendations_feed' : 'block_feed_ads_api',
            payload,
          },
        }));
      });
    }

    const reportCollection = (section: string, detail: string) => window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', method: 'api', domain: 'VK API', section, detail, trigger: apiMethod,
    } }));
    const hasEntries = (value: unknown) => !!value && typeof value === 'object' && Object.keys(value).length > 0;
    const hasAdCollection = hasEntries(data.response.ads) || hasEntries(data.response.ad_posts);
    if (blockFeedAds && hasAdCollection
      && !blocked.some(item => !item.recommendation)) reportCollection('block_feed_ads_api', 'Рекламная подборка ленты');
    let changed = blocked.length > 0;
    if (blockFeedAds && data.response.ads) {
      changed ||= !Array.isArray(data.response.ads) || data.response.ads.length > 0;
      data.response.ads = [];
    }
    if (blockFeedAds && data.response.ad_posts) {
      changed ||= !Array.isArray(data.response.ad_posts) || data.response.ad_posts.length > 0;
      data.response.ad_posts = [];
    }

    if (Array.isArray(data.response.feed_ids)) {
      const previous = data.response.feed_ids;
      data.response.feed_ids = previous.filter(id => {
        if (typeof id === 'string') {
          return !(blockFeedAds && AD_ITEM_TYPES.some(t => id.startsWith(t))) &&
            !(blockFeedRecommendations && [...RECOMMENDATION_TYPES].some(type => id === type || id.startsWith(type + '_') || id.startsWith(type + ':')));
        }
        return true;
      });
      const removedIds = previous.filter(id => !data.response!.feed_ids!.includes(id));
      if (!blocked.some(item => !item.recommendation) && !hasAdCollection
        && removedIds.some(id => typeof id === 'string' && AD_ITEM_TYPES.some(type => id.startsWith(type))))
        reportCollection('block_feed_ads_api', 'Рекламные ссылки ленты');
      if (!blocked.some(item => item.recommendation)
        && removedIds.some(id => typeof id === 'string' && [...RECOMMENDATION_TYPES].some(type => id === type || id.startsWith(type + '_') || id.startsWith(type + ':'))))
        reportCollection('block_recommendations_feed', 'Рекомендательные ссылки ленты');
      changed ||= previous.length !== data.response.feed_ids.length;
    }

    return changed;
  }

  function filterMenu(data: FeedApiResponse): void {
    const sections = data?.response?.sections;
    if (!sections || typeof sections !== 'object') return;
    for (const section of Object.values(sections)) {
      if (Array.isArray(section?.items)) section.items = section.items.filter(item => {
        if (item?.id !== 'l_invite_menu_promo' && item?.id !== 'l_invite_promo') return true;
        reportMessengerPromo();
        return false;
      });
    }
  }

  function filterRightBlock(data: unknown): boolean {
    const block = removeFeedRightPromo(data);
    if (!block) return false;
    const trigger = typeof block.frb_type === 'string' ? block.frb_type.slice(0, 96) : 'recommended_app';
    const title = typeof block.title === 'string' ? block.title.slice(0, 300) : 'Игровой промоблок в ленте';
    window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', method: 'api', domain: 'VK API', url: '/method/newsfeed.getRightBlock',
      section: 'block_recommendations_feed', detail: title, trigger,
      payload: JSON.stringify({ api_method: 'newsfeed.getRightBlock', frb_type: trigger, title }),
    } }));
    return true;
  }

  const batchBodies = new WeakMap<Request, string>();
  const unregisterBatchRequest = registerRequestHook(async (url, input, init) => {
    if (vkApiMethod(url, location.href) === 'batch.call' && input instanceof Request && !init?.body)
      batchBodies.set(input, await input.clone().text());
    return undefined;
  });
  const unregisterBatchResponse = registerResponseHook(async (url, response, input, init) => {
    if ((!blockFeedAds && !blockBrowserPromo && !blockFeedRecommendations) || !response.ok || vkApiMethod(url, location.href) !== 'batch.call') return response;
    const body = init?.body ?? (input instanceof Request ? batchBodies.get(input) : undefined);
    if (typeof body !== 'string') return response;
    const requests = JSON.parse(body)?.requests;
    if (!Array.isArray(requests)) return response;
    const map = new Map(requests.map(item => [String(item?.id), item?.method]));
    const data = await response.clone().json();
    if (!Array.isArray(data?.responses)) return response;
    let changed = false;
    for (const item of data.responses) {
      const method = map.get(String(item?.id));
      if (blockBrowserPromo && method === 'internal.getWebLeftMenu') {
        const before = JSON.stringify(item?.body); filterMenu(item?.body); changed = JSON.stringify(item?.body) !== before || changed;
      } else if (blockFeedRecommendations && method === 'newsfeed.getRightBlock') changed = filterRightBlock(item?.body) || changed;
      else if ((blockFeedAds || blockFeedRecommendations) && FEED_METHODS.has(method)) changed = filterFeedResponse(item?.body, '/method/' + method, method) || changed;
    }
    if (!changed) return response;
    const headers = new Headers(response.headers);
    headers.delete('content-length'); headers.delete('content-encoding');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  });

  const unregisterFetchHook = registerResponseHook(async (url, response) => {
    if (!blockFeedAds && !blockBrowserPromo && !blockFeedRecommendations) return response;
    const method = vkApiMethod(url, location.href);
    if (!method) return response;
    const menu = blockBrowserPromo && method === 'internal.getWebLeftMenu';
    const rightBlock = blockFeedRecommendations && method === 'newsfeed.getRightBlock';
    const known = (blockFeedAds || blockFeedRecommendations) && FEED_METHODS.has(method);
    const mode = !menu && !rightBlock && !known && (blockFeedAds || blockFeedRecommendations) && response.ok &&
      /^application\/(?:[\w.+-]+\+)?json\b/i.test(response.headers.get('content-type') ?? '')
      ? discovery.consider(method) : null;
    if (!menu && !rightBlock && !known && !mode) return response;

    try {
      const data = (mode === 'probe' ? await readFeedProbe(response) : await response.clone().json()) as FeedApiResponse;
      // Recheck after awaiting: disabling protection must take effect in-flight too.
      if (menu ? !blockBrowserPromo : rightBlock ? !blockFeedRecommendations : (!blockFeedAds && !blockFeedRecommendations)) return response;
      if (mode && (data === undefined || !discovery.inspect(method, data))) {
        if (data === undefined) discovery.report(method, 'probe-limit-or-invalid-json');
        return response;
      }
      if (menu) filterMenu(data);
      else if (rightBlock) { if (!filterRightBlock(data)) return response; }
      else if (!filterFeedResponse(data, known ? url : '/method/' + method, method)) return response;

      const headers = new Headers(response.headers);
      headers.delete('content-length'); headers.delete('content-encoding');
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      if (mode) discovery.inspect(method, undefined);
      return response;
    }
  });

  const restorePrefetch = interceptFeedPrefetch(window, entry => {
    if (blockBrowserPromo && filterMessengerBrowserPromo(entry.method, entry.response)) reportMessengerPromo();
    if (blockBrowserPromo && entry.method === 'internal.getWebLeftMenu') filterMenu(entry as FeedApiResponse);
    if (blockFeedRecommendations && entry.method === 'newsfeed.getRightBlock') filterRightBlock(entry);
    if (!blockFeedAds && !blockFeedRecommendations) return;
    const method = vkApiMethod('/method/' + entry.method, location.href);
    if (!method) return;
    // An old/incomplete cache entry must not suppress probing a fresh response.
    if (FEED_METHODS.has(method) || ((isFeedCandidate(method) || hasFeedShape(entry, true)) && discovery.inspect(method, entry, false))) {
      filterFeedResponse(entry as FeedApiResponse, location.href, method);
    }
  });

  const handleSettingsUpdate = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;

    if ('custom_block_words' in detail) customWords.block = normalizeFeedWords(detail.custom_block_words);
    if ('custom_allow_words' in detail) customWords.allow = normalizeFeedWords(detail.custom_allow_words);
    if (typeof detail.block_recommendations_profile === 'boolean') blockProfileAds = detail.block_recommendations_profile;
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

  const handleDestroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    unregisterFetchHook();
    unregisterBatchRequest(); unregisterBatchResponse();
    stopMessengerPromo();
    stopLegacyFeedRight();
    restorePrefetch();
    restoreNoticeFlags();
    window.removeEventListener('vkify-update-settings', handleSettingsUpdate);
    window.removeEventListener('message', handleDestroy);
    blockFeedAds = false;
    blockFeedRecommendations = false;
    blockProfileAds = false;
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
