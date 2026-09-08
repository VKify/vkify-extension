import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';
import { feedItemText, matchFeedWord, normalizeFeedWords, type FeedKeywords } from '../../shared/utils/feed-keywords.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor) return;
  (window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor = true;

  const FEED_PATTERNS = [
    '/method/newsfeed.get',
    '/method/newsfeed.getRecommended',
    '/method/newsfeed.getMulti',
    '/method/newsfeed.getFeedExp',
    '/method/wall.get',
    '/method/owners.getMainTab',
    '/method/search.getSearchAllWeb2',
  ];

  const AD_ITEM_TYPES = [
    'ads', 'ads_easy_promote', 'ads_post',
    'ads_app', 'ads_site', 'ads_vk_apps_slider',
  ];

  const AD_ITEM_FLAGS = ['marked_as_ads', 'is_ad', 'ad_id'];

  // In-memory flag — set via vkify-update-settings event. Never stored in localStorage:
  // localStorage is VK-page-readable and exposes the extension's presence to the site.
  let blockFeedAds = false;
  const customWords: FeedKeywords = { block: [], allow: [] };

  function isFeedUrl(url: string): boolean {
    try {
      const parsed = new URL(url, location.href);
      return /(^|\.)vk\.(com|ru)$/.test(parsed.hostname) && FEED_PATTERNS.includes(parsed.pathname);
    } catch { return false; }
  }

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
    if (typeof type === 'string' && AD_ITEM_TYPES.some(t => type.startsWith(t))) return true;
    if (fi.post_type === 'post_ads') return true;
    if (AD_ITEM_FLAGS.some(f => fi[f])) return true;
    return false;
  }

  interface FeedApiResponse {
    response?: {
      items?: FeedItem[];
      ads?: unknown[];
      ad_posts?: unknown[];
      feed_ids?: unknown[];
      newsfeed_items?: Array<{ id?: unknown; item?: FeedItem }>;
      catalog?: { sections?: Array<{ blocks?: Array<{ newsfeed_item_ids?: unknown[] }> }> };
    };
  }

  /**
   * Extracts a compact, storage-safe snapshot of a blocked feed item.
   * Only the fields that are meaningful for the popup log are kept;
   * `text` is truncated to 400 chars to avoid bloating storage.
   */
  function compactItem(item: FeedItem): Record<string, unknown> {
    const snap: Record<string, unknown> = {};
    const keep = ['type', 'source_id', 'owner_id', 'from_id', 'post_id', 'id', 'post_type',
                  'marked_as_ads', 'is_ad', 'ad_id', 'date', 'ads_easy_promote_level'];
    keep.forEach(k => { if (item[k] !== undefined) snap[k] = item[k]; });
    if (typeof item['text'] === 'string') {
      snap['text'] = (item['text'] as string).slice(0, 400);
    }
    return snap;
  }

  function filterFeedResponse(data: FeedApiResponse, url: string): FeedApiResponse {
    if (!data?.response || typeof data.response !== 'object') return data;

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
        const src = (item['source_id'] ?? item['owner_id'] ?? item['from_id'] ?? '') as string | number;
        let payload: string | undefined;
        try { payload = JSON.stringify(compactItem(item)); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('vkify:blocked', {
          detail: {
            kind: 'ad',
            method: 'api',
            domain: 'VK API',
            url,
            detail: word ? `keyword: ${word.slice(0, 400)}` : adType + (src ? ' · id' + src : ''),
            payload,
          },
        }));
      });
    }

    if (data.response.ads) data.response.ads = [];
    if (data.response.ad_posts) data.response.ad_posts = [];

    if (Array.isArray(data.response.feed_ids)) {
      data.response.feed_ids = data.response.feed_ids.filter(id => {
        if (typeof id === 'string') {
          return !AD_ITEM_TYPES.some(t => id.startsWith(t));
        }
        return true;
      });
    }

    return data;
  }

  const unregisterFetchHook = registerResponseHook(async (url, response) => {
    if (!blockFeedAds || !isFeedUrl(url)) return response;

    try {
      const data = await response.clone().json() as FeedApiResponse;
      const filtered = filterFeedResponse(data, url);

      return new Response(JSON.stringify(filtered), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  });

  const restorePrefetch = interceptFeedPrefetch(window, entry => {
    if (blockFeedAds && isFeedUrl('/method/' + entry.method)) {
      filterFeedResponse(entry as FeedApiResponse, location.href);
    }
  });

  const handleSettingsUpdate = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;

    if ('custom_block_words' in detail) customWords.block = normalizeFeedWords(detail.custom_block_words);
    if ('custom_allow_words' in detail) customWords.allow = normalizeFeedWords(detail.custom_allow_words);

    if (typeof detail.block_feed_ads_api === 'boolean') {
      blockFeedAds = detail.block_feed_ads_api;
      console.log('[VKify/FetchBlock] ' + (blockFeedAds ? 'Activated' : 'Deactivated'));
    }
    // Settings and word-list changes also apply to an existing prefetch cache.
    if (blockFeedAds) {
      const cur = Reflect.get(window, 'cur');
      if (cur && typeof cur === 'object') Reflect.get(cur, 'apiPrefetchCache');
    }
  };
  window.addEventListener('vkify-update-settings', handleSettingsUpdate);

  const handleDestroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    unregisterFetchHook();
    restorePrefetch();
    window.removeEventListener('vkify-update-settings', handleSettingsUpdate);
    window.removeEventListener('message', handleDestroy);
    blockFeedAds = false;
    delete (window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor;
  };
  window.addEventListener('message', handleDestroy);

  console.log('[VKify/FetchBlock] Interceptor loaded');

  // Сигнализируем контентному скрипту, что мы готовы принимать события.
  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'feed-ad-blocker' },
  }));
})();
