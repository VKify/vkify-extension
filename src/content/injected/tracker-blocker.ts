import { registerRequestHook } from '../../shared/utils/fetch-hooks.js';
import { TRACKER_DOMAINS } from '../features/ads-blocking/config.js';
import { createGuardedImageSrcDescriptor } from '../../shared/utils/image-src-guard.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyTrackerBlocker?: boolean }).__vkifyTrackerBlocker) return;
  (window as Window & { __vkifyTrackerBlocker?: boolean }).__vkifyTrackerBlocker = true;

  let blockTrackers = false;
  let blockMusicAds = false;

  const AUDIO_AD_DOMAINS = ['ad.mail.ru', 'mradx.net'] as const;

  function getDomain(url: string): string {
    try {
      const href = url.startsWith('//') ? 'https:' + url : url;
      return new URL(href).hostname || url.slice(0, 50);
    } catch {
      const slash = url.indexOf('/');
      return (slash > 0 ? url.slice(0, slash) : url).slice(0, 50);
    }
  }

  function dispatchBlocked(url: string, kind: 'tracker' | 'ad'): void {
    const domain = getDomain(url);
    window.dispatchEvent(new CustomEvent('vkify:blocked', {
      detail: kind === 'ad'
        ? { kind, domain, url, detail: 'Аудиореклама · сетевой запрос', method: 'network' }
        : { kind, domain, url, method: 'network' },
    }));
  }

  function getBlockKind(url: string): 'tracker' | 'ad' | null {
    if (!url || typeof url !== 'string') return null;
    const urlLower = url.toLowerCase();
    const isAudioAd = AUDIO_AD_DOMAINS.some(domain => urlLower.includes(domain));
    // Music ads are an independent setting: disabling it must not be silently
    // overridden just because these domains also appear in the tracker list.
    if (isAudioAd) return blockMusicAds ? 'ad' : null;
    if (!blockTrackers) return null;
    return (TRACKER_DOMAINS as readonly string[]).some(p => urlLower.includes(p.toLowerCase()))
      ? 'tracker'
      : null;
  }

  function isBlocked(url: string): boolean {
    return getBlockKind(url) !== null;
  }

  function reportBlocked(url: string): void {
    const kind = getBlockKind(url);
    if (kind) dispatchBlocked(url, kind);
  }

  const originalSendBeacon = navigator.sendBeacon;
  const originalWebSocket = window.WebSocket;
  const originalImageSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
  const originalMediaSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  const originalSourceSrc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src');
  const originalScriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  const originalSetAttribute = Element.prototype.setAttribute;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  const unregisterFetchHook = registerRequestHook((url) => {
    const kind = getBlockKind(url);
    if (kind) {
      dispatchBlocked(url, kind);
      return kind === 'ad'
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: new Headers({ 'Content-Type': 'application/json' }),
          });
    }
    return null;
  });

  const patchedSendBeacon = function (url: string, data?: BodyInit | null): boolean {
      const kind = getBlockKind(url);
      if (kind) { dispatchBlocked(url, kind); return true; }
      return originalSendBeacon.call(navigator, url, data);
  };
  if (navigator.sendBeacon) {
    navigator.sendBeacon = patchedSendBeacon;
  }

  const patchedWebSocket = function (url: string, protocols?: string | string[]) {
    const kind = getBlockKind(url);
    if (kind) {
      dispatchBlocked(url, kind);
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
  window.WebSocket = patchedWebSocket;

  (window.WebSocket as unknown as Record<string, unknown>).prototype = originalWebSocket.prototype;
  (window.WebSocket as unknown as Record<string, unknown>).CONNECTING = originalWebSocket.CONNECTING;
  (window.WebSocket as unknown as Record<string, unknown>).OPEN      = originalWebSocket.OPEN;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSING   = originalWebSocket.CLOSING;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSED    = originalWebSocket.CLOSED;

  const patchedImageSrc: PropertyDescriptor | null = originalImageSrc
    ? createGuardedImageSrcDescriptor(originalImageSrc, isBlocked, reportBlocked)
    : null;
  if (patchedImageSrc) Object.defineProperty(Image.prototype, 'src', patchedImageSrc);

  const guardDescriptor = (
    prototype: object,
    original: PropertyDescriptor | undefined,
  ): PropertyDescriptor | null => {
    if (!original) return null;
    const patched = createGuardedImageSrcDescriptor(original, isBlocked, reportBlocked);
    Object.defineProperty(prototype, 'src', patched);
    return patched;
  };
  const patchedMediaSrc = guardDescriptor(HTMLMediaElement.prototype, originalMediaSrc);
  const patchedSourceSrc = guardDescriptor(HTMLSourceElement.prototype, originalSourceSrc);
  const patchedScriptSrc = guardDescriptor(HTMLScriptElement.prototype, originalScriptSrc);

  const resourceTags = new Set(['SCRIPT', 'AUDIO', 'VIDEO', 'SOURCE', 'IMG', 'IFRAME']);
  const patchedSetAttribute = function (this: Element, qualifiedName: string, value: string): void {
    if (qualifiedName.toLowerCase() === 'src' && resourceTags.has(this.tagName) && isBlocked(value)) {
      reportBlocked(value);
      originalSetAttribute.call(this, qualifiedName, '');
      return;
    }
    originalSetAttribute.call(this, qualifiedName, value);
  };
  Element.prototype.setAttribute = patchedSetAttribute;

  const patchedXHROpen = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ): void {
    (this as XMLHttpRequest & { _vkifyTrackerUrl?: string })._vkifyTrackerUrl = url.toString();
    originalXHROpen.apply(this, [method, url, ...rest] as Parameters<typeof originalXHROpen>);
  };
  const patchedXHRSend = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    const self = this as XMLHttpRequest & { _vkifyTrackerUrl?: string };
    const url = self._vkifyTrackerUrl ?? '';
    const kind = getBlockKind(url);
    if (kind) {
      dispatchBlocked(url, kind);
      queueMicrotask(() => self.abort());
      return;
    }
    originalXHRSend.call(this, body);
  };
  XMLHttpRequest.prototype.open = patchedXHROpen;
  XMLHttpRequest.prototype.send = patchedXHRSend;

  function neutralizeResourceNode(node: Node): void {
    if (!(node instanceof Element)) return;
    const elements = resourceTags.has(node.tagName)
      ? [node]
      : Array.from(node.querySelectorAll(
          'script[src], audio[src], video[src], source[src], img[src], iframe[src]',
        ));
    for (const element of elements) {
      const src = element.getAttribute('src') ?? '';
      if (!isBlocked(src)) continue;
      reportBlocked(src);
      originalSetAttribute.call(element, 'src', '');
      if (element instanceof HTMLMediaElement) {
        try { element.pause(); } catch { /* ignore */ }
      }
    }
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
    let sawScript = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        neutralizeResourceNode(node);
        if ((node as Element).tagName === 'SCRIPT') sawScript = true;
      }
    }
    if (sawScript) setTimeout(neutralizeGlobals, 50);
  });

  const handleSettingsUpdate = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;
    if (typeof detail.block_trackers === 'boolean') {
      blockTrackers = detail.block_trackers;
      if (blockTrackers) {
        neutralizeGlobals();
      }
    }
    if (typeof detail.block_music_ads === 'boolean') blockMusicAds = detail.block_music_ads;
    if (blockTrackers || blockMusicAds) {
      _globalsObserver.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      _globalsObserver.disconnect();
    }
  };
  window.addEventListener('vkify-update-settings', handleSettingsUpdate);

  const handleDestroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    unregisterFetchHook();
    _globalsObserver.disconnect();
    window.removeEventListener('vkify-update-settings', handleSettingsUpdate);
    window.removeEventListener('message', handleDestroy);
    if (navigator.sendBeacon === patchedSendBeacon) navigator.sendBeacon = originalSendBeacon;
    if (window.WebSocket === patchedWebSocket) window.WebSocket = originalWebSocket;
    if (Element.prototype.setAttribute === patchedSetAttribute) {
      Element.prototype.setAttribute = originalSetAttribute;
    }
    if (XMLHttpRequest.prototype.open === patchedXHROpen) XMLHttpRequest.prototype.open = originalXHROpen;
    if (XMLHttpRequest.prototype.send === patchedXHRSend) XMLHttpRequest.prototype.send = originalXHRSend;
    const currentImageSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
    if (
      originalImageSrc &&
      patchedImageSrc &&
      currentImageSrc?.get === patchedImageSrc.get &&
      currentImageSrc?.set === patchedImageSrc.set
    ) {
      Object.defineProperty(Image.prototype, 'src', originalImageSrc);
    }
    const restoreDescriptor = (
      prototype: object,
      original: PropertyDescriptor | undefined,
      patched: PropertyDescriptor | null,
    ): void => {
      const current = Object.getOwnPropertyDescriptor(prototype, 'src');
      if (original && patched && current?.get === patched.get && current?.set === patched.set) {
        Object.defineProperty(prototype, 'src', original);
      }
    };
    restoreDescriptor(HTMLMediaElement.prototype, originalMediaSrc, patchedMediaSrc);
    restoreDescriptor(HTMLSourceElement.prototype, originalSourceSrc, patchedSourceSrc);
    restoreDescriptor(HTMLScriptElement.prototype, originalScriptSrc, patchedScriptSrc);
    blockTrackers = false;
    blockMusicAds = false;
    delete (window as Window & { __vkifyTrackerBlocker?: boolean }).__vkifyTrackerBlocker;
  };
  window.addEventListener('message', handleDestroy);

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'tracker-blocker' },
  }));
})();
