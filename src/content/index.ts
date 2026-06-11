import { installExtApi } from '../shared/ext-api.js';
import { VKifyApp } from './core/app.js';
import { startThemeSync, stopThemeSync } from './services/theme-sync.js';
import { applyCssMarkersFromMirror } from './core/css-marker-mirror.js';
import { applyInjectedCssFromMirror } from './core/injected-css-mirror.js';
import { applyThemeFromMirror } from './features/appearance/theme-mirror.js';
import { applyFontLinkFromMirror } from './features/appearance/fontManager.js';

// Apply everything CSS-related synchronously, before first paint, from the
// localStorage mirrors — so feature CSS, dynamically-injected CSS (width, offset,
// avatar radius, fonts, image background) and the custom theme all take effect
// instantly with no flash. The authoritative reconcile against chrome.storage
// happens later inside app.init(). Must run first, at document_start. See
// core/css-marker-mirror.ts, core/injected-css-mirror.ts,
// features/appearance/theme-mirror.ts.
applyCssMarkersFromMirror();
applyInjectedCssFromMirror();
applyThemeFromMirror();
applyFontLinkFromMirror();

installExtApi(); // cross-browser chrome/browser normalisation — before any chrome.* call

const app = new VKifyApp();

// Синхронизация схемы VK → chrome.storage (для темы попапа «Как в ВК»).
// Не зависит от инициализации фич; сам дожидается готовности DOM.
startThemeSync();

// After the extension is reloaded/updated/disabled, any content script already
// injected into an open VK tab becomes orphaned: every chrome.* call from a
// still-registered listener / MutationObserver / timer throws
// "Extension context invalidated". Chrome offers no way to un-inject the dead
// script, so the only correct behaviour is to go silent and stop working.
//
// content/index.ts previously only guarded app.init(); any post-init callback
// that threw produced an uncaught console error on every extension reload
// (e.g. content.js:… "Extension context invalidated"). This mirrors the
// background SW's global handler. Hunting the single throwing callsite is
// futile — dozens of async callbacks may be first to fire after invalidation;
// a top-level suppressor that also tears the instance down covers them all.
const BENIGN_LIFECYCLE_ERRORS = [
  'Extension context invalidated',
  'Receiving end does not exist',
  'message port closed',
];

function isBenignLifecycleError(value: unknown): boolean {
  const msg = typeof value === 'string'
    ? value
    : (value as { message?: string } | null | undefined)?.message;
  return !!msg && BENIGN_LIFECYCLE_ERRORS.some(s => msg.includes(s));
}

function handleOrphaned(): void {
  // Disconnects observers, removes listeners, clears timers so the dead
  // instance cannot keep throwing on the next tick. Idempotent.
  try { app.cleanup(); } catch { /* already torn down */ }
  try { stopThemeSync(); } catch { /* already torn down */ }
}

// Only suppress OUR lifecycle errors — vk.com page code cannot produce the
// "Extension context invalidated" string, so real page errors still surface.
window.addEventListener('error', (event) => {
  if (isBenignLifecycleError(event.error) || isBenignLifecycleError(event.message)) {
    event.preventDefault();
    handleOrphaned();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (isBenignLifecycleError(event.reason)) {
    event.preventDefault();
    handleOrphaned();
  }
});

const safeInit = (): void => {
  app.init().catch((err: unknown) => {
    if (!isBenignLifecycleError(err)) {
      console.error('[VKify] Init error:', err);
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInit);
} else {
  safeInit();
}

// Debug handle — stripped from production builds by Vite (import.meta.env.DEV → false).
// Never expose the app instance to the page context in production: the VK page can
// call featureManager.disable() or access storage through window.VKify.
declare global {
  interface Window {
    __VKify_debug?: VKifyApp;
  }
}

if (import.meta.env.DEV) {
  window.__VKify_debug = app;
}