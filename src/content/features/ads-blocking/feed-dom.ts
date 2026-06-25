/**
 * DOM-level feed-ad blocker.
 *
 * Works entirely in the content-script context — no injected scripts:
 *   1. Permanent CSS rules that hide known ad selectors instantly.
 *   2. MutationObserver + periodic interval for JS-based post analysis.
 *   3. Multi-signal heuristic (erid, sponsored markers, ad CDNs, CTA + external
 *      links, aria-labels) to minimise false positives.
 *
 * Every blocked post is recorded with a `trigger` string that describes exactly
 * what signal fired, so the popup log can highlight the cause with colour.
 *
 * Hidden posts are restored (display reset + attributes removed) when the
 * feature is disabled.
 *
 * Migrated to DOMObserver + selectors: сканирование идёт через
 * ctx.observeChanges (общий MutationObserver + perf-тайминг), маркер
 * нативной рекламы VK вынесен в SELECTORS.feed.nativeAdButton.
 */

import type { FeatureContext } from '../../core/feature-context.js';
import type { SharedContext } from './shared.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { CONFIG, PROCESSED_ATTR, BLOCKED_ATTR } from './config.js';

export interface FeedDomBlocker {
  enable(): void;
  disable(): void;
  forceScan(): void;
}

export function createFeedDomBlocker(
  ctx:    FeatureContext,
  shared: SharedContext,
): FeedDomBlocker {
  let isEnabled  = false;
  let off:        (() => void) | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let styleEl:    HTMLStyleElement | null = null;

  /**
   * Tracks DOM elements that have already been recorded in the stats log.
   *
   * WeakSet so entries are GC-collected when VK removes old post elements
   * after SPA navigation.  Prevents duplicate log entries that occur when
   * reapplyOnNavigate calls disable() → enable() while old posts are still
   * in the DOM: the post is blocked again (correct) but not logged twice.
   */
  const loggedPosts = new WeakSet<Element>();

  // ── Post hiding ───────────────────────────────────────────────────────────

  function hidePost(post: Element, trigger: string): void {
    (post as HTMLElement).style.setProperty('display', 'none', 'important');
    post.setAttribute(BLOCKED_ATTR, 'true');

    if (!loggedPosts.has(post)) {
      loggedPosts.add(post);
      const snippet = post.textContent?.trim().replace(/\s+/g, ' ').slice(0, 300) ?? '';
      shared.recordBlock('ad', 'лента ВКонтакте', snippet, 'dom', trigger);
      console.log(`[AdBlocker/DOM] Hidden (${trigger}):`, snippet.slice(0, 80));
    }
  }

  // ── Detection helpers ─────────────────────────────────────────────────────

  /** Returns the first matching hard marker, or null. */
  function findHardMarker(text: string): string | null {
    return CONFIG.hardMarkers.find(m => text.includes(m)) ?? null;
  }

  /** Returns the first matching CTA phrase in text, or null. */
  function findCTAInText(text: string): string | null {
    return CONFIG.ctaPhrases.find(p => text.includes(p)) ?? null;
  }

  /** Returns the first matching CTA phrase found in button labels, or null. */
  function findCTAInButtons(buttons: NodeListOf<Element>): string | null {
    for (const btn of buttons) {
      const label = btn.textContent?.toLowerCase() || '';
      const match = CONFIG.ctaPhrases.find(p => label.includes(p));
      if (match) return match;
    }
    return null;
  }

  /** Returns the first ad CDN domain found in image sources, or null. */
  function findAdDomain(images: NodeListOf<Element>): string | null {
    for (const img of images) {
      const src = (img as HTMLImageElement).src || '';
      const domain = (CONFIG.adDomains as readonly string[]).find(d => src.includes(d));
      if (domain) return domain;
      if (src.includes('utm_')) return 'utm-параметры';
      if (src.includes('_ga=')) return 'google-analytics';
    }
    return null;
  }

  /**
   * Detects markup-based obfuscation of «реклама» in raw innerHTML:
   *   рекл&shy;ама   (HTML entity)
   *   рекл<wbr>ама   (HTML tag)
   *   рекл​ама  (zero-width space)
   *
   * Requires ≥1 HTML tag, entity, or invisible-Unicode char between «рекл» and
   * «ама», so plain «реклама» and cross-word matches are impossible.
   */
  function hasObfuscatedAd(html: string): boolean {
    return /рекл(?:<[^>]{0,60}>|&[a-z#][a-z\d]{0,9};|[­​-‍﻿])+ама/i.test(html);
  }

  /** Returns true if any link points outside VK. */
  function hasExternal(links: NodeListOf<Element>): boolean {
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href || '';
      if (!href) continue;
      if (
        href.includes('vk.com')     ||
        href.includes('vkontakte')  ||
        href.includes('vk.ru')      ||
        href.includes('vk.cc')      ||
        href.startsWith('/')
      ) continue;
      return true;
    }
    return false;
  }

  // ── Ad detection — returns trigger string or null ─────────────────────────

  /**
   * Examines `post` and returns a short human-readable trigger string if the
   * post should be blocked, or `null` if it looks clean.
   *
   * Each check short-circuits so the cheapest tests run first.
   */
  function detectAdTrigger(post: Element): string | null {
    const text = post.textContent?.toLowerCase() || '';

    // 1. Custom allow-list — absolute priority, never block
    if (
      shared.customWords.allow.length > 0 &&
      shared.customWords.allow.some(w => w && text.includes(w))
    ) return null;

    // 2. Custom block-list
    if (shared.customWords.block.length > 0) {
      const word = shared.customWords.block.find(w => w && text.includes(w));
      if (word) return `Стоп-слово: «${word}»`;
    }

    // 3. Hard markers (erid, спонсор, на правах рекламы, …)
    const marker = findHardMarker(text);
    if (marker) return `Маркер: «${marker.trim()}»`;

    const links   = post.querySelectorAll('a[href]');
    const images  = post.querySelectorAll('img');
    const buttons = post.querySelectorAll(CONFIG.buttonSelectors);

    // 4. Рекламный CDN / tracking-params в картинках
    const adDomain = findAdDomain(images);
    if (adDomain) return `Рекламный домен: ${adDomain}`;

    // 5. Нативная реклама VK (кнопка «Рекламная запись»)
    if (post.querySelector(SELECTORS.feed.nativeAdButton)) {
      return 'Нативная реклама VK';
    }

    // 6. aria-label содержит «реклам» (VK сам помечает продвигаемые посты)
    for (const el of post.querySelectorAll('[aria-label]')) {
      const label = el.getAttribute('aria-label')?.toLowerCase() || '';
      if (label.includes('реклам')) return `aria-label: «${label}»`;
    }

    // 7. Слово «реклам» + CTA-фраза или CTA-кнопка.
    //    Намеренно НЕ проверяем hasExternal — иначе любой пост, обсуждающий
    //    блокировщик рекламы и содержащий ссылку (t.me, chromewebstore…),
    //    будет ложно заблокирован.
    if (text.includes(CONFIG.adWordTrigger)) {
      const ctaText = findCTAInText(text);
      if (ctaText) return `«реклам» + CTA: «${ctaText}»`;

      const ctaBtn = findCTAInButtons(buttons);
      if (ctaBtn) return `«реклам» + кнопка «${ctaBtn}»`;
    }

    // 8. CTA-фраза + внешняя ссылка (без слова «реклам»)
    const ctaText = findCTAInText(text);
    if (ctaText && hasExternal(links)) return `CTA «${ctaText}» + внешняя ссылка`;

    // 9. Обфусцированное слово «реклама»
    if (hasObfuscatedAd((post as HTMLElement).innerHTML)) {
      return 'Обфусцированное слово «реклама»';
    }

    return null;
  }

  // ── Scan loop ─────────────────────────────────────────────────────────────

  function scanAndBlock(): void {
    if (!isEnabled) return;

    const selector = CONFIG.postSelectors.join(', ');
    const posts    = document.querySelectorAll(selector);
    let count = 0;

    posts.forEach(post => {
      // closest() checks the element itself AND every ancestor.
      // This skips nested selector matches (e.g. article[data-index] wrapping
      // [data-testid="post"]) — the outer element is processed first (DOM order),
      // so the inner one finds PROCESSED_ATTR via closest() and is skipped,
      // preventing duplicate log entries for a single logical post.
      if (post.closest(`[${PROCESSED_ATTR}]`)) return;
      post.setAttribute(PROCESSED_ATTR, 'true');
      if (post.hasAttribute(BLOCKED_ATTR)) return;

      const trigger = detectAdTrigger(post);
      if (trigger !== null) {
        hidePost(post, trigger);
        count++;
      }
    });

    if (count > 0) {
      console.log(`[AdBlocker/DOM] Blocked ${count} ad(s) via DOM scan`);
    }
  }

  // ── CSS injection ─────────────────────────────────────────────────────────

  function injectPermanentCSS(): void {
    const adDomains = CONFIG.adDomains as readonly string[];
    const postSel   = CONFIG.postSelectors as readonly string[];

    const css = `
      [${BLOCKED_ATTR}="true"] {
        display: none !important;
      }

      [class*="erid"],
      [class*="Erid"],
      [data-testid="videos_for_you_block_spa"],
      .apps_feedRightAppsBlock {
        display: none !important;
      }

      ${adDomains.map(d => `img[src*="${d}"]`).join(',\n      ')} {
        display: none !important;
      }

      ${adDomains.map(d =>
        postSel.map(s => `${s}:has(img[src*="${d}"])`).join(',\n      ')
      ).join(',\n      ')} {
        display: none !important;
      }

      ${postSel.map(s =>
        `${s}:has(${SELECTORS.feed.nativeAdButton})`
      ).join(',\n      ')} {
        display: none !important;
      }
    `;

    styleEl?.remove();
    styleEl = document.createElement('style');
    styleEl.id = 'ad-blocker-dom-styles';
    styleEl.textContent = css;
    document.head.insertBefore(styleEl, document.head.firstChild);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  function enable(): void {
    if (isEnabled) return;
    isEnabled = true;

    void shared.loadStats();
    injectPermanentCSS();
    scanAndBlock();
    // Общий observer с дебаунсом: scanAndBlock сам проверяет isEnabled и
    // идемпотентен (PROCESSED_ATTR), так что лишние проходы безвредны.
    // Через manager (не domObserver напрямую) — чтобы время scanAndBlock
    // относилось на runtime-бюджет block_feed_ads_dom в Performance Dashboard.
    off?.();
    off = ctx.observeChanges('block_feed_ads_dom', scanAndBlock, { schedule: { debounceMs: CONFIG.scanDebounceMs } });

    // Extra pass after the first React/Vue render cycle
    requestAnimationFrame(scanAndBlock);

    intervalId = setInterval(() => {
      if (!isEnabled || document.hidden) return;
      scanAndBlock();
    }, CONFIG.periodicScanMs);

    console.log('[AdBlocker/DOM] Enabled (CSS + JS analysis)');
  }

  function disable(): void {
    if (!isEnabled) return;
    isEnabled = false;

    if (intervalId)  clearInterval(intervalId);
    off?.();
    off = null;
    styleEl?.remove();

    // Restore all DOM-hidden posts
    document.querySelectorAll(`[${BLOCKED_ATTR}="true"]`).forEach(el => {
      (el as HTMLElement).style.display = '';
      el.removeAttribute(BLOCKED_ATTR);
      el.removeAttribute(PROCESSED_ATTR);
    });

    console.log('[AdBlocker/DOM] Disabled');
  }

  function forceScan(): void {
    if (isEnabled) scanAndBlock();
  }

  return { enable, disable, forceScan };
}
