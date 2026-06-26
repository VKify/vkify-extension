/**
 * BridgeTransport — транспорт к инжектированному vk-api-bridge.ts через
 * postMessage (page-world `window.vkApi.api()`).
 *
 * Канал общий со страницей, поэтому каждое сообщение штампуется per-session
 * nonce'ом (см. shared/utils/page-channel). При недоступности моста или
 * таймауте — вызывается переданный `fallback` (как правило, token-fetch).
 *
 * Выделено из прежнего VKApiClient: сервис (vk-api-service.ts) владеет токеном
 * и высокоуровневыми методами, транспорт — только доставкой вызова в page-world.
 */

import { PostMessageType } from '@/shared/constants/messages.js';
import { nonceMatches } from '@/shared/utils/page-channel.js';

interface NativeApiResolver {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  fallback: () => void;
}

interface NativeApiResponse {
  callId: number;
  success: boolean;
  data?: unknown;
  error?: string;
  fallbackToToken?: boolean;
}

const NATIVE_CALL_TIMEOUT_MS = 10_000;

export class BridgeTransport {
  /** Доступен ли нативный мост (выставляется по NATIVE_API_AVAILABLE). */
  available = false;

  private channelNonce = '';
  private readonly pending = new Map<number, NativeApiResolver>();
  private callId = 0;

  constructor() {
    this._listen();
  }

  /** Per-session nonce, общий с инжектированным мостом (ставит VKifyApp). */
  setChannelNonce(nonce: string): void {
    this.channelNonce = nonce;
  }

  private _listen(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return;
      // Канал моста несёт параметры API (текст сообщений, peer-id):
      // принимаем только сообщения с нашим per-session nonce.
      if (!nonceMatches(this.channelNonce, event.data?.nonce)) return;

      if (event.data?.type === PostMessageType.NATIVE_API_AVAILABLE) {
        this.available = event.data.available as boolean;
        console.log('[VKify API] Native vkApi.api():',
          this.available ? '✓ available' : '✗ not available');
        return;
      }

      if (event.data?.type === PostMessageType.NATIVE_API_RESPONSE) {
        this._handleResponse(event.data as NativeApiResponse);
      }
    });
  }

  private _handleResponse(data: NativeApiResponse): void {
    const resolver = this.pending.get(data.callId);
    if (!resolver) return;

    this.pending.delete(data.callId);

    if (data.success) {
      resolver.resolve(data.data);
    } else if (data.fallbackToToken) {
      resolver.fallback();
    } else {
      resolver.reject(new Error(data.error ?? 'Native API call failed'));
    }
  }

  /**
   * Выполняет вызов через мост. Если мост сигналит fallbackToToken или ответ
   * не пришёл за таймаут — вызывает `fallback()` и резолвится его результатом.
   */
  call(
    method: string,
    params: Record<string, unknown>,
    fallback: () => Promise<unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const callId = ++this.callId;

      const runFallback = () => {
        fallback().then(resolve).catch(reject);
      };

      this.pending.set(callId, { resolve, reject, fallback: runFallback });

      window.postMessage(
        { type: PostMessageType.NATIVE_API_CALL, method, params, callId, nonce: this.channelNonce },
        window.location.origin,
      );

      setTimeout(() => {
        if (this.pending.has(callId)) {
          this.pending.delete(callId);
          runFallback();
        }
      }, NATIVE_CALL_TIMEOUT_MS);
    });
  }
}
