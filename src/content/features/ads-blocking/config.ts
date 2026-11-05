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
} as const;

// Request classification lives in shared/tracker-url.ts.

/**
 * DOM-layer configuration.
 *
 * Only covers what the network interceptor cannot handle: tracking
 * iframes that were already present in the initial HTML before
 * the injected script loaded.
 *
 * Script-tag removal was intentionally removed — inline scripts execute
 * synchronously during HTML parsing, so removing the tag after the fact
 * never undoes already-run code.
 */
export const TRACKER_DOM_CONFIG = {
  /** CSS selectors for tracking iframes. */
  relatedSelectors: [
    'iframe[src*="top-fwz1.mail.ru"]',
    'iframe[src*="mc.yandex.ru"]',
    'iframe[src*="doubleclick.net"]',
  ],
  scanIntervalMs: 3000,
} as const;

/** DOM attribute set on every post that has been examined. */
export const PROCESSED_ATTR = 'data-ad-checked';

/** DOM attribute set on posts that were hidden as ads. */
export const BLOCKED_ATTR = 'data-ad-blocked';
