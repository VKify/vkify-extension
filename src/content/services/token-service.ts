import type { VKApiService } from '../core/api/index.js';
import type { StorageManager } from '../core/storage.js';
import type { ContextGuard } from '../utils/context-guard.js';
import { EventEmitter } from '../../shared/utils/event-emitter.js';
import { PostMessageType } from '../../shared/constants/messages.js';
import { nonceMatches } from '../../shared/utils/page-channel.js';

interface TokenMessageData {
  type: typeof PostMessageType.TOKEN_UPDATE | typeof PostMessageType.TOKEN_RESPONSE;
  token?: string;
  userId?: string;
  expiresAt?: number;
  nonce?: string;
}

interface TokenServiceEvents {
  tokenReceived: undefined;
  userIdReceived: string;
}

export class TokenService {
  private readonly vkApi: VKApiService;
  private readonly storage: StorageManager;
  private readonly contextGuard: ContextGuard;
  private readonly nonce: string;
  private _listener: ((event: MessageEvent) => void) | null = null;

  readonly events = new EventEmitter<TokenServiceEvents>();

  constructor(vkApi: VKApiService, storage: StorageManager, contextGuard: ContextGuard, nonce: string) {
    this.vkApi = vkApi;
    this.storage = storage;
    this.contextGuard = contextGuard;
    this.nonce = nonce;
  }

  setup(): void {
    if (this.contextGuard.destroyed) return;

    this._listener = (event: MessageEvent) => this.handleMessage(event);
    window.addEventListener('message', this._listener);

    this.restoreFromStorage();
  }

  stop(): void {
    if (this._listener) {
      window.removeEventListener('message', this._listener);
      this._listener = null;
    }
    // Уведомляем инжектированные скрипты (vk-api.js, spy.js) об инвалидации контекста,
    // чтобы они сбросили fetch-патчи и очистили setInterval.
    window.postMessage({ type: PostMessageType.DESTROY, nonce: this.nonce }, window.location.origin);
  }

  async handleMessage(event: MessageEvent<TokenMessageData>): Promise<void> {
    if (this.contextGuard.destroyed) return;
    if (event.source !== window) return;
    if (event.data?.type !== PostMessageType.TOKEN_UPDATE) return;
    // Only accept token messages stamped with our per-session nonce — blocks
    // passive harvesting of VKIFY_TOKEN_UPDATE by unrelated page listeners.
    if (!nonceMatches(this.nonce, event.data?.nonce)) return;

    const { token, userId, expiresAt } = event.data;

    if (token) {
      this.vkApi.setToken(token, expiresAt ?? null);

      await this.contextGuard.safeExecute(async () => {
        await this.storage.set('vk_access_token', token);
        if (expiresAt) await this.storage.set('vk_token_expires_at', expiresAt);
      });

      console.log('[VKify] Token received from page');
      this.events.emit('tokenReceived', undefined);
    }

    if (userId) {
      await this.contextGuard.safeExecute(async () => {
        await this.storage.set('vk_user_id', userId);
      });

      console.log('[VKify] User ID received:', userId);
      this.events.emit('userIdReceived', userId);
    }

    this.contextGuard.safeExecute(() => {
      chrome.runtime.sendMessage({ type: 'VK_TOKEN_UPDATE', token, userId, expiresAt }).catch(() => {});
    });
  }

  async restoreFromStorage(): Promise<void> {
    await this.contextGuard.safeExecute(async () => {
      const token = await this.storage.get<string>('vk_access_token');
      const expiresAt = await this.storage.get<number>('vk_token_expires_at');
      const userId = await this.storage.get<string>('vk_user_id');

      if (token) {
        this.vkApi.setToken(token, expiresAt ?? null);
        console.log('[VKify] Token restored from storage');
      }

      if (userId) {
        console.log('[VKify] User ID restored:', userId);
        this.events.emit('userIdReceived', userId);
      }
    });
  }

  requestFreshToken(): Promise<{ token: string | null; userId: string | null }> {
    if (this.contextGuard.destroyed) {
      return Promise.resolve({ token: null, userId: null });
    }

    return new Promise(resolve => {
      const handler = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data?.type !== PostMessageType.TOKEN_RESPONSE) return;
        if (!nonceMatches(this.nonce, event.data?.nonce)) return;

        window.removeEventListener('message', handler);
        clearTimeout(timeout);

        resolve({
          token: (event.data.token as string) ?? null,
          userId: (event.data.userId as string) ?? null,
        });
      };

      window.addEventListener('message', handler);
      window.postMessage({ type: PostMessageType.TOKEN_REQUEST, nonce: this.nonce }, window.location.origin);

      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ token: null, userId: null });
      }, 3000);
    });
  }
}