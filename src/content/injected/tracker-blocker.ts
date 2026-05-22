import { registerRequestHook } from '../../shared/utils/fetch-hooks.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyTrackerBlocker?: boolean }).__vkifyTrackerBlocker) return;
  (window as Window & { __vkifyTrackerBlocker?: boolean }).__vkifyTrackerBlocker = true;

  let blockTrackers = false;

  const ANALYTICS_PATTERNS = [
    // VK ads and analytics subdomains
    'ads.vk.com', 'ad.vk.com', 'stat.vk.com', 'stats.vk.com',
    'counter.vk.com', 'counters.vk.com', 'pixel.vk.com',
    'akashi.vk.com', 'stacks.vk.com', 'vk-analytics.ru',
    // VK Play tracking
    '1l-hit.vkplay.ru', '1l-view.vkplay.ru', 'tracker.vkplay.ru', 'stats.vkplay.ru',
    // VK Portal stats (the stats subdomain, not the main portal API)
    'stats.vk-portal.net',
    // VK retargeting and ad rotation endpoints
    'vk.com/rtrg', 'vk.com/ads_rotate',
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
    'mc.yandex.ru', 'mc.yandex.com', 'amc.yandex.ru', 'an.yandex.ru',
    'tns-counter.ru', 'counter.yadro.ru', 'top.rutarget.ru',
    // Nielsen
    'scorecardresearch.com',
    // External analytics and ad services
    'google-analytics.com', 'googletagmanager.com',
    'hotjar.com', 'mixpanel.com', 'amplitude.com', 'segment.com', 'segment.io',
    'facebook.com/tr', 'connect.facebook.net', 'pixel.facebook.com', 'fbcdn.net',
    'doubleclick.net',
    'adriver.ru', 'adfox.ru', 'mytarget.ru',
    'analytics.tiktok.com', 'googlesyndication.com',
    'sentry.io',
  ];

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
    return ANALYTICS_PATTERNS.some(pattern => urlLower.includes(pattern.toLowerCase()));
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

  neutralizeGlobals();

  const _globalsObserver = new MutationObserver((mutations) => {
    if (!blockTrackers) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if ((node as Element).tagName === 'SCRIPT') {
          setTimeout(neutralizeGlobals, 50);
          return;
        }
      }
    }
  });
  _globalsObserver.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('vkify-update-settings', function (event: Event) {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;
    if (typeof detail.block_trackers === 'boolean') {
      blockTrackers = detail.block_trackers;
      if (detail.block_trackers) neutralizeGlobals();
    }
  });

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'tracker-blocker' },
  }));
})();