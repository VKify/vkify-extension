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

  (window as unknown as { WebSocket: typeof WebSocket }).WebSocket = function (url: string, protocols?: string | string[]) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);
    const originalSend = ws.send.bind(ws);

    ws.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      if (shouldBlockRequest(data)) return;
      return originalSend(data);
    };

    return ws;
  } as unknown as typeof WebSocket;

  (window.WebSocket as unknown as Record<string, unknown>).prototype = OriginalWebSocket.prototype;
  (window.WebSocket as unknown as Record<string, unknown>).CONNECTING = OriginalWebSocket.CONNECTING;
  (window.WebSocket as unknown as Record<string, unknown>).OPEN = OriginalWebSocket.OPEN;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSING = OriginalWebSocket.CLOSING;
  (window.WebSocket as unknown as Record<string, unknown>).CLOSED = OriginalWebSocket.CLOSED;

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ) {
    (this as XMLHttpRequest & { _vkifyUrl?: string })._vkifyUrl = url.toString();
    return originalXHROpen.apply(this, [method, url, ...rest] as Parameters<typeof originalXHROpen>);
  };

  XMLHttpRequest.prototype.send = function (data?: Document | XMLHttpRequestBodyInit | null) {
    const self = this as XMLHttpRequest & { _vkifyUrl?: string };
    if (shouldBlockRequest(data) || shouldBlockRequest(self._vkifyUrl)) return;
    return originalXHRSend.apply(this, arguments as unknown as [Document | XMLHttpRequestBodyInit | null | undefined]);
  };

  registerRequestHook((url, _input, init) => {
    const body = init?.body || '';
    if (shouldBlockRequest(url) || shouldBlockRequest(body)) {
      return new Response(null, { status: 204 });
    }
    return null;
  });

  window.addEventListener('vkify-update-settings', function (event: Event) {
    const detail = (event as CustomEvent).detail;
    if (!detail) return;

    if (typeof detail.prevent_typing === 'boolean') preventTyping = detail.prevent_typing;
    if (typeof detail.prevent_read === 'boolean') preventRead = detail.prevent_read;
  });

  console.log('[VKify] Privacy module loaded');

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'anti-tracking' },
  }));
})();