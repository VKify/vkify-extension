import { registerRequestHook } from '../../shared/utils/fetch-hooks.js';
import { TRACKER_DOMAINS } from '../features/ads-blocking/config.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyTrackerBlocker?: boolean }).__vkifyTrackerBlocker) return;
  (window as Window & { __vkifyTrackerBlocker?: boolean }).__vkifyTrackerBlocker = true;

  let blockTrackers = false;

  function getDomain(url: string): string {
    try {
      const href = url.startsWith('//') ? 'https:' + url : url;
      return new URL(href).hostname || url.slice(0, 50);
    } catch {
      const slash = url.indexOf('/');
      return (slash > 0 ? url.slice(0, slash) : url).slice(0, 50);
    }
  }

  function dispatchBlocked(url: string): void {
    window.dispatchEvent(new CustomEvent('vkify:blocked', {
      detail: { kind: 'tracker', domain: getDomain(url), url },
    }));
  }

  function isAnalytics(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    if (!blockTrackers) return false;
    const urlLower = url.toLowerCase();
    return (TRACKER_DOMAINS as readonly string[]).some(p => urlLower.includes(p.toLowerCase()));
  }

  const originalSendBeacon = navigator.sendBeacon;
  const originalWebSocket = window.WebSocket;
  const originalImageSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');

  registerRequestHook((url) => {
    if (isAnalytics(url)) {
      dispatchBlocked(url);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });
    }
    return null;
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon = function (url: string, data?: BodyInit | null): boolean {
      if (isAnalytics(url)) { dispatchBlocked(url); return true; }
      return originalSendBeacon.call(navigator, url, data);
    };
  }

  window.WebSocket = function (url: string, protocols?: string | string[]) {
    if (isAnalytics(url)) {
      dispatchBlocked(url);
      return {
        send: function () {},
        close: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () { return true; },
        readyState: 3,
        url,
        bufferedAmount: 0,
        extensions: '',
        protocol: '',
        binaryType: 'blob' as BinaryType,
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
      } as unknown as WebSocket;
    }
    return protocols ? new originalWebSocket(url, protocols) : new originalWebSocket(url);
  } as unknown as typeof WebSocket;

  (window.WebSocket as unknown as Record<string, unknown>).prototype = originalWebSocket.prototype;
  (window.WebSocket as unknown as Record<string, unknown>).CONNECTING = originalWebSocket.CONNECTING;
  (window.WebSocket as unknown as Record<string, unknown>).OPEN      = originalWebSocket.OPEN;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSING   = originalWebSocket.CLOSING;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSED    = originalWebSocket.CLOSED;

  if (originalImageSrc) {
    Object.defineProperty(Image.prototype, 'src', {
      get: function () {
        return (this as HTMLImageElement & { _vkifySrc?: string })._vkifySrc || '';
      },
      set: function (value: string) {
        const img = this as HTMLImageElement & { _vkifySrc?: string };
        if (isAnalytics(value)) {
          dispatchBlocked(value);
          img._vkifySrc = '';
          return;
        }
        img._vkifySrc = value;
        if (originalImageSrc.set) originalImageSrc.set.call(this, value);
      },
      configurable: true,
    });
  }

  function neutralizeGlobals(): void {
    if (!blockTrackers) return;

    const analyticsFunctions = [
      'sendStats', 'trackEvent', 'logEvent', 'reportStats',
      'collectStats', 'gatherStats', 'reportError',
      'trackPageView', 'trackClick', 'trackScroll', 'trackHover',
    ];

    analyticsFunctions.forEach(funcName => {
      try {
        if ((window as unknown as Record<string, unknown>)[funcName]) {
          (window as unknown as Record<string, unknown>)[funcName] = function () { return null; };
        }
      } catch { /* ignore */ }
    });

    const analyticsObjects = [
      'vkStats', 'vkAnalytics', 'statsMeta', 'performance_observers',
      'sentry', 'error_monitoring', 'akashi', 'metrika',
      'VKAnalytics', 'VKStats', 'VKMetrics', 'VKTracker',
    ];

    analyticsObjects.forEach(obj => {
      try {
        if ((window as unknown as Record<string, unknown>)[obj])
          delete (window as unknown as Record<string, unknown>)[obj];
      } catch { /* ignore */ }
    });

    try {
      const w = window as unknown as Record<string, unknown>;
      if (w['_tmr']) w['_tmr'] = { push: function () {}, getCounters: function () { return []; } };
      if (w['ym'])   w['ym']   = function () {};
      if (w['gtag']) w['gtag'] = function () {};
      if (w['ga'])   w['ga']   = function () {};
      if (w['fbq'])  w['fbq']  = function () {};
    } catch { /* ignore */ }

    try {
      const w = window as unknown as Record<string, { Retargeting?: Record<string, unknown> }>;
      if (w.VK?.Retargeting) {
        w.VK.Retargeting = { Init: function () {}, Hit: function () {}, Event: function () {}, Add: function () {} };
      }
    } catch { /* ignore */ }
  }

  // Watch for dynamically injected scripts and re-neutralize globals.
  // The observer is started/stopped together with blockTrackers so it doesn't
  // run pointlessly when the feature is disabled.
  const _globalsObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).tagName === 'SCRIPT') {
          setTimeout(neutralizeGlobals, 50);
          return;
        }
      }
    }
  });

  window.addEventListener('vkify-update-settings', function (event: Event) {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;
    if (typeof detail.block_trackers === 'boolean') {
      blockTrackers = detail.block_trackers;
      if (blockTrackers) {
        neutralizeGlobals();
        _globalsObserver.observe(document.documentElement, { childList: true, subtree: true });
      } else {
        _globalsObserver.disconnect();
      }
    }
  });

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'tracker-blocker' },
  }));
})();