import { registerRequestHook } from '../../shared/utils/fetch-hooks.js';

(function () {
  'use strict';

  if ((window as Window & { __vkifyPrivacyModule?: boolean }).__vkifyPrivacyModule) return;
  (window as Window & { __vkifyPrivacyModule?: boolean }).__vkifyPrivacyModule = true;

  const PRIVACY_FILTERS = {
    typing: ['im.setActivity', 'messages.setActivity', 'act=typing', 'a_activity'],
    read: ['messages.markAsRead', 'im.markAsRead', 'act=read', 'a_mark_read'],
  };

  // In-memory settings — populated via vkify-update-settings event from the content
  // script after waitForInjectedScript resolves. Never stored in localStorage:
  // localStorage is shared with the VK page (VK can read/write vkify_* keys and
  // detect the extension, or disable protection by overwriting the value).
  let preventTyping = false;
  let preventRead = false;
  let preventStoryViews = false;

  // Inspect the operation, not track_code: retrieving a story must still work.
  function isStoryView(url: string, body?: unknown): boolean {
    if (!preventStoryViews) return false;
    let parsed: URL;
    try { parsed = new URL(url, location.href); } catch { return false; }
    if (!/(^|\.)vk\.(com|ru)$/i.test(parsed.hostname)) return false;
    if (/^\/method\/stories\.markSeen\/?$/i.test(parsed.pathname)) return true;
    const params = new URLSearchParams(parsed.search);
    if (typeof body === 'string' || body instanceof URLSearchParams) {
      new URLSearchParams(body).forEach((value, key) => params.set(key, value));
    } else if (body instanceof FormData) {
      body.forEach((value, key) => { if (typeof value === 'string') params.set(key, value); });
    }
    return /^stories\.markSeen$/i.test(params.get('method') ?? '')
      || (/^\/method\/execute$/i.test(parsed.pathname)
        && /\bAPI\s*\.\s*stories\s*\.\s*markSeen\s*\(/i.test(params.get('code') ?? ''));
  }

  function shouldBlockRequest(data: unknown): boolean {
    if (!data) return false;

    if (!preventTyping && !preventRead) return false;

    let dataString = typeof data === 'string' ? data : '';
    if (typeof data === 'object') {
      try { dataString = JSON.stringify(data); } catch { return false; }
    }

    const dataLower = dataString.toLowerCase();

    if (preventTyping) {
      for (const pattern of PRIVACY_FILTERS.typing) {
        if (dataLower.includes(pattern.toLowerCase())) {
          console.log('[VKify] Blocked typing');
          return true;
        }
      }
    }

    if (preventRead) {
      for (const pattern of PRIVACY_FILTERS.read) {
        if (dataLower.includes(pattern.toLowerCase())) {
          console.log('[VKify] Blocked read');
          return true;
        }
      }
    }

    return false;
  }

  const OriginalWebSocket = window.WebSocket;

  const PatchedWebSocket = function (url: string, protocols?: string | string[]) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    const originalSend = ws.send.bind(ws);

    ws.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      if (shouldBlockRequest(data)) return;
      return originalSend(data);
    };

    return ws;
  } as unknown as typeof WebSocket;
  (window as unknown as { WebSocket: typeof WebSocket }).WebSocket = PatchedWebSocket;

  (window.WebSocket as unknown as Record<string, unknown>).prototype = OriginalWebSocket.prototype;
  (window.WebSocket as unknown as Record<string, unknown>).CONNECTING = OriginalWebSocket.CONNECTING;
  (window.WebSocket as unknown as Record<string, unknown>).OPEN = OriginalWebSocket.OPEN;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSING = OriginalWebSocket.CLOSING;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSED = OriginalWebSocket.CLOSED;

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  const patchedXHROpen = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ) {
    (this as XMLHttpRequest & { _vkifyUrl?: string })._vkifyUrl = url.toString();
    return originalXHROpen.apply(this, [method, url, ...rest] as Parameters<typeof originalXHROpen>);
  };

  const patchedXHRSend = function (
    this: XMLHttpRequest,
    data?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const self = this as XMLHttpRequest & { _vkifyUrl?: string };
    if (isStoryView(self._vkifyUrl ?? '', data) || shouldBlockRequest(data) || shouldBlockRequest(self._vkifyUrl)) {
      queueMicrotask(() => self.abort());
      return;
    }
    return originalXHRSend.apply(this, arguments as unknown as [Document | XMLHttpRequestBodyInit | null | undefined]);
  };
  XMLHttpRequest.prototype.open = patchedXHROpen;
  XMLHttpRequest.prototype.send = patchedXHRSend;

  const unregisterFetchHook = registerRequestHook(async (url, input, init) => {
    let body = init?.body || '';
    if (preventStoryViews && !init?.body && input instanceof Request && !input.bodyUsed) {
      try { body = await input.clone().text(); } catch { /* URL matching still applies. */ }
    }
    if (isStoryView(url, body)) {
      return new Response(JSON.stringify({ response: 1 }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    if (shouldBlockRequest(url) || shouldBlockRequest(body)) {
      return new Response(null, { status: 204 });
    }
    return null;
  });

  const originalBeacon = navigator.sendBeacon;
  const patchedBeacon: typeof navigator.sendBeacon = function (url, data) {
    if (isStoryView(url.toString(), data)) return true;
    return originalBeacon.call(navigator, url, data);
  };
  navigator.sendBeacon = patchedBeacon;

  const handleSettingsUpdate = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;

    if (typeof detail.prevent_typing === 'boolean') preventTyping = detail.prevent_typing;
    if (typeof detail.prevent_read === 'boolean') preventRead = detail.prevent_read;
    if (typeof detail.prevent_story_views === 'boolean') preventStoryViews = detail.prevent_story_views;
  };
  window.addEventListener('vkify-update-settings', handleSettingsUpdate);

  const handleDestroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;

    unregisterFetchHook();
    if (navigator.sendBeacon === patchedBeacon) navigator.sendBeacon = originalBeacon;
    window.removeEventListener('vkify-update-settings', handleSettingsUpdate);
    window.removeEventListener('message', handleDestroy);
    if (window.WebSocket === PatchedWebSocket) window.WebSocket = OriginalWebSocket;
    if (XMLHttpRequest.prototype.open === patchedXHROpen) {
      XMLHttpRequest.prototype.open = originalXHROpen;
    }
    if (XMLHttpRequest.prototype.send === patchedXHRSend) {
      XMLHttpRequest.prototype.send = originalXHRSend;
    }
    preventTyping = false;
    preventRead = false;
    preventStoryViews = false;
    delete (window as Window & { __vkifyPrivacyModule?: boolean }).__vkifyPrivacyModule;
  };
  window.addEventListener('message', handleDestroy);

  console.log('[VKify] Privacy module loaded');

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'anti-tracking' },
  }));
})();
