import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor) return;
  (window as Window & { __vkifyAdFetchInterceptor?: boolean }).__vkifyAdFetchInterceptor = true;

  const FEED_PATTERNS = [
    '/method/newsfeed.get',
    '/method/newsfeed.getRecommended',
    '/method/newsfeed.getMulti',
  ];

  const AD_ITEM_TYPES = [
    'ads', 'ads_easy_promote', 'ads_post',
    'ads_app', 'ads_site', 'ads_vk_apps_slider',
  ];

  const AD_ITEM_FLAGS = ['marked_as_ads', 'is_ad', 'ad_id'];

  // In-memory flag — set via vkify-update-settings event. Never stored in localStorage:
  // localStorage is VK-page-readable and exposes the extension's presence to the site.
  let blockFeedAds = false;

  function isFeedUrl(url: string): boolean {
    return FEED_PATTERNS.some(p => url.includes(p));
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
    if (AD_ITEM_TYPES.some(t => (type as string).startsWith(t))) return true;
    if (AD_ITEM_FLAGS.some(f => fi[f])) return true;
    return false;
  }

  interface FeedApiResponse {
    response?: {
      items?: FeedItem[];
      ads?: unknown[];
      ad_posts?: unknown[];
      feed_ids?: unknown[];
    };
  }

  /**
   * Extracts a compact, storage-safe snapshot of a blocked feed item.
   * Only the fields that are meaningful for the popup log are kept;
   * `text` is truncated to 400 chars to avoid bloating storage.
   */
  function compactItem(item: FeedItem): Record<string, unknown> {
    const snap: Record<string, unknown> = {};
    const keep = ['type', 'source_id', 'owner_id', 'from_id', 'post_id',
                  'marked_as_ads', 'is_ad', 'ad_id', 'date', 'ads_easy_promote_level'];
    keep.forEach(k => { if (item[k] !== undefined) snap[k] = item[k]; });
    if (typeof item['text'] === 'string') {
      snap['text'] = (item['text'] as string).slice(0, 400);
    }
    return snap;
  }

  function filterFeedResponse(data: FeedApiResponse, url: string): FeedApiResponse {
    if (!data?.response?.items || !Array.isArray(data.response.items)) return data;

    const blocked: FeedItem[] = [];
    data.response.items = data.response.items.filter(item => {
      if (isAdItem(item)) { blocked.push(item); return false; }
      return true;
    });

    if (blocked.length > 0) {
      console.log('[VKify/FetchBlock] Filtered ' + blocked.length + ' ad(s) from API response');
      blocked.forEach(item => {
        const adType = (item.type as string) || 'ads';
        const src = (item['source_id'] ?? item['owner_id'] ?? item['from_id'] ?? '') as string | number;
        let payload: string | undefined;
        try { payload = JSON.stringify(compactItem(item)); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('vkify:blocked', {
          detail: {
            kind: 'ad',
            method: 'api',
            domain: 'VK API',
            url,
            detail: adType + (src ? ' · id' + src : ''),
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

  const handleSettingsUpdate = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;

    if (typeof detail.block_feed_ads_api === 'boolean') {
      blockFeedAds = detail.block_feed_ads_api;
      console.log('[VKify/FetchBlock] ' + (blockFeedAds ? 'Activated' : 'Deactivated'));
    }
  };
  window.addEventListener('vkify-update-settings', handleSettingsUpdate);

  const handleDestroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    unregisterFetchHook();
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
