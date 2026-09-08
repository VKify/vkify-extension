/** DOM feed filter: user keywords only, with live rescanning and reversible hiding. */

import type { FeatureContext } from '../../core/feature-context.js';
import type { SharedContext } from './shared.js';
import { matchFeedWord } from '@/shared/utils/feed-keywords.js';
import { CONFIG, PROCESSED_ATTR, BLOCKED_ATTR } from './config.js';
import { t } from '@/content/i18n/index.js';

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
    const style = (post as HTMLElement).style;
    if (!originalDisplay.has(post)) originalDisplay.set(post, { value: style.getPropertyValue('display'), priority: style.getPropertyPriority('display') });
    style.setProperty('display', 'none', 'important');
    post.setAttribute(BLOCKED_ATTR, 'true');

    if (!loggedPosts.has(post)) {
      loggedPosts.add(post);
      const snippet = post.textContent?.trim().replace(/\s+/g, ' ').slice(0, 300) ?? '';
      shared.recordBlock('ad', t('ads.source_feed'), snippet, 'dom', trigger);
      console.log(`[AdBlocker/DOM] Hidden (${trigger}):`, snippet.slice(0, 80));
    }
  }

  function detectAdTrigger(post: Element): string | null {
    const word = matchFeedWord(post.textContent ?? '', shared.customWords);
    return word ? t('ads.stopword', { word }) : null;
  }

  let checkedText = new WeakMap<Element, string>();
  const originalDisplay = new WeakMap<Element, { value: string; priority: string }>();

  function restorePost(post: Element): void {
    const style = (post as HTMLElement).style;
    const original = originalDisplay.get(post);
    if (original?.value) style.setProperty('display', original.value, original.priority);
    else style.removeProperty('display');
    originalDisplay.delete(post);
    post.removeAttribute(BLOCKED_ATTR);
  }

  // ── Scan loop ─────────────────────────────────────────────────────────────

  function scanAndBlock(): void {
    if (!isEnabled) return;

    const selector = CONFIG.postSelectors.join(', ');
    const posts    = document.querySelectorAll(selector);
    let count = 0;

    posts.forEach(post => {
      // Only scan the outer post when VK nests several matching containers.
      if (post.parentElement?.closest(selector)) return;
      const text = post.textContent ?? '';
      if (checkedText.get(post) === text) return;
      checkedText.set(post, text);
      post.setAttribute(PROCESSED_ATTR, 'true');

      const trigger = detectAdTrigger(post);
      if (trigger !== null) {
        hidePost(post, trigger);
        count++;
      } else if (post.hasAttribute(BLOCKED_ATTR)) {
        restorePost(post);
      }
    });

    if (count > 0) {
      console.log(`[AdBlocker/DOM] Blocked ${count} ad(s) via DOM scan`);
    }
  }

  // ── CSS injection ─────────────────────────────────────────────────────────

  function injectPermanentCSS(): void {
    const css = `[${BLOCKED_ATTR}="true"] { display: none !important; }`;

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
    // пропускает посты с неизменившимся текстом, так что лишние проходы безвредны.
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
      restorePost(el);
    });

    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => el.removeAttribute(PROCESSED_ATTR));
    checkedText = new WeakMap();
    console.log('[AdBlocker/DOM] Disabled');
  }

  function forceScan(): void {
    checkedText = new WeakMap();
    if (isEnabled) scanAndBlock();
  }

  return { enable, disable, forceScan };
}
