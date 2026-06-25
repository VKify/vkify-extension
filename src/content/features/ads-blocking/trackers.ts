/**
 * Tracker blocker.
 *
 * Two-layer approach:
 *   1. Network layer — injects `tracker-blocker.ts` into the page context,
 *      which patches fetch / sendBeacon / WebSocket / Image.src to drop
 *      requests to known tracker domains (see TRACKER_DOMAINS in config.ts).
 *   2. DOM layer — MutationObserver + periodic interval to remove tracking
 *      pixels (<img width="1">, hidden <iframe>, etc.) that were already in
 *      the initial HTML before the injected script loaded.
 *
 * Script-tag removal is intentionally absent: <script> elements execute
 * synchronously during HTML parsing, so removing the tag after insertion
 * never undoes code that has already run. Network interception (layer 1)
 * is the correct place to stop outbound tracker requests.
 */

import type { FeatureContext } from '../../core/feature-context.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import type { SharedContext } from './shared.js';
import { TRACKER_DOM_CONFIG } from './config.js';

interface TrackerState {
  observer:   MutationObserver | null;
  intervalId: ReturnType<typeof setInterval> | null;
  destroyed:  boolean;
}

export interface TrackerBlocker {
  enable(): void;
  disable(): void;
}

export function createTrackerBlocker(
  ctx:    FeatureContext,
  shared: SharedContext,
): TrackerBlocker {
  let trackerState: TrackerState | null = null;

  // ── DOM helpers ───────────────────────────────────────────────────────────

  function pixelDomain(el: Element): string {
    const src = (el as HTMLImageElement | HTMLIFrameElement).src || '';
    if (!src) return el.tagName.toLowerCase();
    try { return new URL(src).hostname; } catch { return src.slice(0, 50); }
  }

  /**
   * Removes tracking pixels and hidden iframes from the DOM and records each
   * removal in the shared stats log (visible in the popup).
   */
  function removePixelsFromDOM(): void {
    const selectors = TRACKER_DOM_CONFIG.relatedSelectors.join(', ');
    const found: Element[] = [];

    try {
      document.querySelectorAll(selectors).forEach(el => found.push(el));
    } catch {
      // Some :has() selectors may fail in older Chrome — fall back one-by-one
      for (const sel of TRACKER_DOM_CONFIG.relatedSelectors) {
        try { document.querySelectorAll(sel).forEach(el => found.push(el)); }
        catch { /* skip unsupported selector */ }
      }
    }

    for (const el of found) {
      const src    = (el as HTMLImageElement | HTMLIFrameElement).src || '';
      const domain = pixelDomain(el);
      el.remove();
      shared.recordBlock('tracker', domain, src || undefined, 'dom');
    }

    if (found.length > 0) {
      console.log(`[TrackerBlocker/DOM] Removed ${found.length} tracking pixel(s)`);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  function enable(): void {
    if (trackerState) disable();

    trackerState = { observer: null, intervalId: null, destroyed: false };
    const state  = trackerState;

    void shared.loadStats();
    shared.addListenerUser();

    ctx.injectScript(InjectedScript.TRACKER_BLOCKER);
    waitForInjectedScript(InjectedScript.TRACKER_BLOCKER).then(() => {
      ctx.sendEvent('vkify-update-settings', { block_trackers: true });
    });

    removePixelsFromDOM();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    state.observer = new MutationObserver(mutations => {
      if (!trackerState || trackerState.destroyed) return;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (!trackerState || trackerState.destroyed) return;
            removePixelsFromDOM();
          }, 50);
          return;
        }
      }
    });

    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    state.intervalId = setInterval(() => {
      if (!trackerState || trackerState.destroyed || document.hidden) return;
      removePixelsFromDOM();
    }, TRACKER_DOM_CONFIG.scanIntervalMs);

    console.log('[TrackerBlocker] Enabled (network interceptor + DOM fallback)');
  }

  function disable(): void {
    if (!trackerState) return;
    trackerState.destroyed = true;

    ctx.sendEvent('vkify-update-settings', { block_trackers: false });
    shared.releaseListenerUser();

    trackerState.observer?.disconnect();
    trackerState.observer = null;

    if (trackerState.intervalId) {
      clearInterval(trackerState.intervalId);
      trackerState.intervalId = null;
    }

    trackerState = null;
    console.log('[TrackerBlocker] Disabled (page reload needed to fully restore)');
  }

  return { enable, disable };
}
