/** Configuration constants for the ads-blocking feature module. */

export const CONFIG = {
  scanDebounceMs: 16,
  periodicScanMs: 2000,
  postSelectors: [
    'article[data-index]',
    '[data-testid="post"]',
    '[data-post-id]',
    '.feed_row article',
    '.page_block article',
  ],
  adDomains: [
    'mradx.net', 'yandex.net', 'yastat.net',
    'ad.mail.ru', 'favicon.yandex.net', 'get-direct',
  ],
  // Однозначные маркеры рекламы — блокируют пост самостоятельно.
  hardMarkers: ['erid', 'спонсор', 'sponsored', ' advert', 'на правах рекламы', 'партнёрский материал', 'партнерский материал'],
  ctaPhrases: ['купить', 'заказать', 'узнать больше', 'подробнее'],
  buttonSelectors: 'button, [role="button"], .vkuiButton, [class*="button"]',
  // 'реклам' блокирует только в сочетании хотя бы с одним дополнительным сигналом.
  adWordTrigger: 'реклам',
} as const;

/**
 * Single source-of-truth for all tracker / analytics domains.
 *
 * Imported by both layers:
 *   - network layer  → src/content/injected/tracker-blocker.ts
 *   - DOM layer      → trackers.ts (via TRACKER_DOM_CONFIG below)
 *
 * Keeping one list prevents the two layers from silently drifting apart.
 */
export const TRACKER_DOMAINS = [
  // VK ads and analytics subdomains
  'ads.vk.ru', 'ad.vk.ru', 'stat.vk.ru', 'stats.vk.ru',
  'counter.vk.ru', 'counters.vk.ru', 'pixel.vk.ru',
  'akashi.vk.ru', 'stacks.vk.ru', 'vk-analytics.ru',
  // VK Play tracking
  '1l-hit.vkplay.ru', '1l-view.vkplay.ru', 'tracker.vkplay.ru', 'stats.vkplay.ru',
  // VK Portal stats
  'stats.vk-portal.net',
  // VK retargeting and ad rotation endpoints
  'vk.ru/rtrg', 'vk.ru/ads_rotate',
  // VK internal analytics paths
  'al/vklog', 'al_stats.php', 'stats_http', 'statlogs',
  'adsint', 'ads.events', 'ads.stats', 'ads.analytics', 'motion_kit',
  'ad_event', 'ad_view', 'ad_click',
  'mini_apps_stats', 'games_stats', 'apps_analytics',
  'mini_app_event', 'game_event',
  // Pixel / beacon trackers
  'utm.gif', 'pixel.gif', 'counter.gif',
  // Mail.ru / VK Group ad network
  'top-fwz1.mail.ru', 'top.mail.ru', 'ad.mail.ru', 'r.mail.ru', 'mytopf.mail.ru',
  // Yandex Metrica
  'mc.yandex.ru', 'mc.yandex.com', 'yandex.ru/metrika', 'yandex.ru/metrica',
  'amc.yandex.ru', 'an.yandex.ru',
  'tns-counter.ru', 'counter.yadro.ru', 'top.rutarget.ru',
  // Nielsen
  'scorecardresearch.com',
  // Google
  'google-analytics.com', 'googletagmanager.com', 'googlesyndication.com', 'doubleclick.net',
  // Social pixels
  'connect.facebook.net', 'pixel.facebook.com', 'facebook.com/tr', 'fbcdn.net',
  // Ad networks
  'adriver.ru', 'adfox.ru', 'ads.adfox.ru', 'banners.adfox.ru', 'mytarget.ru',
  // Analytics SaaS
  'analytics.tiktok.com', 'hotjar.com', 'mixpanel.com', 'amplitude.com',
  'segment.com', 'segment.io',
  // Error monitoring
  'sentry.io',
] as const;

/**
 * DOM-layer configuration.
 *
 * Only covers what the network interceptor cannot handle: tracking pixels
 * and hidden iframes that were already present in the initial HTML before
 * the injected script loaded.
 *
 * Script-tag removal was intentionally removed — inline scripts execute
 * synchronously during HTML parsing, so removing the tag after the fact
 * never undoes already-run code.
 */
export const TRACKER_DOM_CONFIG = {
  /** CSS selectors for tracking pixels, 1×1 images, and hidden iframes. */
  relatedSelectors: [
    'img[src*="top-fwz1.mail.ru"]', 'img[src*="top.mail.ru"]',
    'img[src*="mc.yandex.ru"]', 'img[src*="pixel."]',
    'img[src*="counter."]', 'img[width="1"][height="1"]',
    'img[style*="display: none"]',
    'iframe[src*="top-fwz1.mail.ru"]',
    'iframe[src*="mc.yandex.ru"]',
    'iframe[src*="doubleclick.net"]',
    'noscript:has(img[src*="top-fwz1.mail.ru"])',
    'noscript:has(img[src*="mc.yandex.ru"])',
  ],
  scanIntervalMs: 3000,
} as const;

/** DOM attribute set on every post that has been examined. */
export const PROCESSED_ATTR = 'data-ad-checked';

/** DOM attribute set on posts that were hidden as ads. */
export const BLOCKED_ATTR = 'data-ad-blocked';
