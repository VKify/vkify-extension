import { PostMessageType } from '../../shared/constants/messages.js';
import { readChannelNonce, nonceMatches } from '../../shared/utils/page-channel.js';

(function () {
  'use strict';

  type WindowWithExtractor = Window & {
    __VKifyTokenExtractor?: VKTokenExtractor;
    vk?: { id?: number };
    cur?: { oid?: number };
  };

  if ((window as WindowWithExtractor).__VKifyTokenExtractor) return;

  // Per-session nonce handed to us by the content script on our <script> tag.
  // Read synchronously here, before the tag is removed on load.
  const NONCE = readChannelNonce();
  const ORIGIN = window.location.origin;

  class VKTokenExtractor {
    token: string | null = null;
    tokenExpiresAt: number | null = null;
    userId: number | null = null;

    private _intervalId: ReturnType<typeof setInterval> | null = null;

    constructor() {
      this._init();
    }

    private _init(): void {
      window.addEventListener('message', (event: MessageEvent) => {
        if (event.source !== window) return;

        // Inbound control messages must carry our nonce.
        if (event.data?.type === PostMessageType.DESTROY) {
          if (!nonceMatches(NONCE, event.data?.nonce)) return;
          this.destroy();
          return;
        }

        if (event.data?.type !== PostMessageType.TOKEN_REQUEST) return;
        if (!nonceMatches(NONCE, event.data?.nonce)) return;

        this.token = this._extractUserToken();
        this.userId = this._extractUserId();

        window.postMessage({
          type: PostMessageType.TOKEN_RESPONSE,
          token: this.token,
          userId: this.userId,
          expiresAt: this.tokenExpiresAt,
          nonce: NONCE,
        }, ORIGIN);
      });

      this.userId = this._extractUserId();
      this.token = this._extractUserToken();

      if (this.token || this.userId) {
        this._sendToExtension();
      }

      // NOTE: we deliberately do NOT monkeypatch window.fetch to scrape the
      // access_token out of VK's own outgoing API requests. That actively
      // materialized a secret VK kept in memory onto the page bus + storage,
      // widening VK's own attack surface. We rely only on what VK already
      // persists in localStorage, re-checked on an interval below.
      this._intervalId = setInterval(() => this._checkData(), 10000);

      console.log('[VKify Token] Initialized',
        this.token ? '✓ Token' : '✗ Token',
        this.userId ? `✓ User ${this.userId}` : '✗ User'
      );
    }

    destroy(): void {
      if (this._intervalId !== null) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
      console.log('[VKify Token] Destroyed');
    }

    private _extractUserId(): number | null {
      try {
        const w = window as WindowWithExtractor;
        if (w.vk?.id && w.vk.id > 0) return Math.abs(w.vk.id);
        if (w.cur?.oid && w.cur.oid > 0) return Math.abs(w.cur.oid);
      } catch (e) {
        console.warn('[VKify] Error extracting user ID:', e);
      }
      return null;
    }

    private _extractUserToken(): string | null {
      if (!this.userId) return null;

      try {
        const token = this._getTokenFromLocalStorage();
        if (token) return token;
      } catch (e) {
        console.warn('[VKify Token] Extraction error:', e);
      }

      return null;
    }

    private _getTokenFromLocalStorage(): string | null {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.includes('web_token')) continue;

          const val = localStorage.getItem(key);
          if (!val) continue;

          try {
            const parsed = JSON.parse(val) as Record<string, string>;
            const token = parsed?.access_token || parsed?.accessToken || parsed?.token;
            if (this._isValidToken(token)) {
              console.log('[VKify Token] Found in localStorage:', key);
              return token;
            }
          } catch {
            const match = val.match(/["']?(?:access_)?token["']?\s*[:=]\s*["']([^"']{50,250})["']/);
            if (match && this._isValidToken(match[1])) return match[1];
          }
        }
      } catch { /* ignore */ }
      return null;
    }

    private _isValidToken(token: unknown): token is string {
      if (!token || typeof token !== 'string') return false;
      if (token.length < 50 || token.length > 300) return false;
      if (/^(anonym|guest)/i.test(token)) return false;
      return true;
    }

    private _checkData(): void {
      const newUserId = this._extractUserId();
      if (newUserId && newUserId !== this.userId) {
        this.userId = newUserId;
        this._sendToExtension();
      }

      if (this.userId && !this.token) {
        const newToken = this._extractUserToken();
        if (newToken && newToken !== this.token) {
          this.token = newToken;
          this._sendToExtension();
          console.log('[VKify Token] Updated');
        }
      }
    }

    private _sendToExtension(): void {
      window.postMessage({
        type: PostMessageType.TOKEN_UPDATE,
        token: this.token,
        userId: this.userId,
        expiresAt: this.tokenExpiresAt,
        nonce: NONCE,
      }, ORIGIN);
    }

    getToken(): string | null { return this.token; }
    getUserId(): number | null { return this.userId; }
  }

  (window as WindowWithExtractor).__VKifyTokenExtractor = new VKTokenExtractor();
})();