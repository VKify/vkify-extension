import { PostMessageType } from '../../shared/constants/messages.js';
import { readChannelNonce, nonceMatches } from '../../shared/utils/page-channel.js';

(function () {
  'use strict';

  type WindowWithBridge = Window & {
    __VKifyApiBridge?: VKApiBridge;
    vkApi?: { api: (method: string, params: Record<string, unknown>) => Promise<unknown> };
  };

  if ((window as WindowWithBridge).__VKifyApiBridge) return;

  const NONCE = readChannelNonce();
  const ORIGIN = window.location.origin;

  class VKApiBridge {
    isAvailable = false;

    constructor() {
      this._init();
    }

    private _init(): void {
      this._checkAvailability();

      window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data?.type !== PostMessageType.NATIVE_API_CALL) return;
        if (!nonceMatches(NONCE, event.data?.nonce)) return;
        this._handleApiCall(event.data as { method: string; params: Record<string, unknown>; callId: number });
      });

      console.log('[VKify API Bridge] Initialized',
        this.isAvailable ? '✓ vkApi available' : '✗ vkApi not available'
      );
    }

    private _checkAvailability(): void {
      try {
        const w = window as WindowWithBridge;
        this.isAvailable = typeof w.vkApi === 'object' && typeof w.vkApi?.api === 'function';
      } catch {
        this.isAvailable = false;
      }

      if (!this.isAvailable) {
        const checkInterval = setInterval(() => {
          this._checkAvailability();
          if (this.isAvailable) {
            clearInterval(checkInterval);
            console.log('[VKify API Bridge] vkApi now available ✓');
            this._notifyAvailability();
          }
        }, 1000);

        setTimeout(() => clearInterval(checkInterval), 10000);
      }
    }

    _notifyAvailability(): void {
      window.postMessage(
        { type: PostMessageType.NATIVE_API_AVAILABLE, available: this.isAvailable, nonce: NONCE },
        ORIGIN,
      );
    }

    private async _handleApiCall(data: { method: string; params: Record<string, unknown>; callId: number }): Promise<void> {
      const { method, params, callId } = data;
      const w = window as WindowWithBridge;

      if (!this.isAvailable || !w.vkApi) {
        this._sendResponse(callId, { success: false, error: 'vkApi not available', fallbackToToken: true });
        return;
      }

      try {
        const result = await w.vkApi.api(method, params);
        this._sendResponse(callId, { success: true, data: result });
      } catch (error) {
        console.error(`[VKify API Bridge] ${method} error:`, error);
        this._sendResponse(callId, {
          success: false,
          error: (error as Error).message || 'API call failed',
          fallbackToToken: true,
        });
      }
    }

    private _sendResponse(callId: number, response: Record<string, unknown>): void {
      window.postMessage(
        { type: PostMessageType.NATIVE_API_RESPONSE, callId, nonce: NONCE, ...response },
        ORIGIN,
      );
    }

    checkAvailability(): boolean {
      return this.isAvailable;
    }
  }

  (window as WindowWithBridge).__VKifyApiBridge = new VKApiBridge();

  setTimeout(() => {
    (window as WindowWithBridge).__VKifyApiBridge?._notifyAvailability();
  }, 100);
})();