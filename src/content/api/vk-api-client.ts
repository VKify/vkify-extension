import type { VKUser, VKUserRaw } from '../../types/index.js';
import { fetchVKMethod, isVKTokenError } from '../../shared/utils/vk-fetch.js';
import { PostMessageType } from '../../shared/constants/messages.js';
import { nonceMatches } from '../../shared/utils/page-channel.js';
import { TtlCache } from '../../shared/utils/ttl-cache.js';
import { perfCollector } from '../core/perf/collector.js';

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

export class VKApiClient {
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;
  private userCache = new TtlCache<number, VKUser>();
  nativeApiAvailable = false;
  private pendingNativeCalls = new Map<number, NativeApiResolver>();
  private nativeCallId = 0;
  private channelNonce = '';

  constructor() {
    this._setupNativeApiListener();
  }

  /** Per-session nonce shared with the injected bridge (set by VKifyApp). */
  setChannelNonce(nonce: string): void {
    this.channelNonce = nonce;
  }

  private _setupNativeApiListener(): void {
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window) return;
      // The bridge channel can carry API params (message text, peer ids):
      // accept only messages stamped with our per-session nonce.
      if (!nonceMatches(this.channelNonce, event.data?.nonce)) return;

      if (event.data?.type === PostMessageType.NATIVE_API_AVAILABLE) {
        this.nativeApiAvailable = event.data.available as boolean;
        console.log('[VKify API] Native vkApi.api():',
          this.nativeApiAvailable ? '✓ available' : '✗ not available');
        return;
      }

      if (event.data?.type === PostMessageType.NATIVE_API_RESPONSE) {
        this._handleNativeApiResponse(event.data as NativeApiResponse);
      }
    });
  }

  private _handleNativeApiResponse(data: NativeApiResponse): void {
    const resolver = this.pendingNativeCalls.get(data.callId);
    if (!resolver) return;

    this.pendingNativeCalls.delete(data.callId);

    if (data.success) {
      resolver.resolve(data.data);
    } else if (data.fallbackToToken) {
      resolver.fallback();
    } else {
      resolver.reject(new Error(data.error ?? 'Native API call failed'));
    }
  }

  private async _callNativeApi(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const callId = ++this.nativeCallId;

      const fallback = () => {
        this._callWithToken(method, params).then(resolve).catch(reject);
      };

      this.pendingNativeCalls.set(callId, { resolve, reject, fallback });

      window.postMessage(
        { type: PostMessageType.NATIVE_API_CALL, method, params, callId, nonce: this.channelNonce },
        window.location.origin,
      );

      setTimeout(() => {
        if (this.pendingNativeCalls.has(callId)) {
          this.pendingNativeCalls.delete(callId);
          fallback();
        }
      }, 10000);
    });
  }


  setToken(token: string, expiresAt: number | null = null): void {
    this.token = token;
    this.tokenExpiresAt = expiresAt;
    console.log('[VKify API] Token set:', token ? '✓' : '✗');
  }

  getToken(): string | null {
    return this.token;
  }

  hasToken(): boolean {
    return !!this.token && !this.isTokenExpired();
  }

  isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return false;
    return Date.now() >= this.tokenExpiresAt;
  }

  clearToken(): void {
    this.token = null;
    this.tokenExpiresAt = null;
    this.userCache.clear();
  }


  async call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    perfCollector.recordApiCall();
    if (this.nativeApiAvailable) {
      try {
        return await this._callNativeApi(method, params);
      } catch (error) {
        console.warn(`[VKify API] Native API failed for ${method}, trying token:`, (error as Error).message);
      }
    }
    return this._callWithToken(method, params);
  }

  private async _callWithToken(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.hasToken()) throw new Error('No access token available');

    try {
      return await fetchVKMethod(method, this.token!, params);
    } catch (error) {
      // Invalid/expired token → drop it so the next call re-acquires one.
      if (isVKTokenError(error)) this.clearToken();
      console.error(`[VKify API] ${method} error:`, error);
      throw error;
    }
  }

  async execute(code: string): Promise<unknown> {
    return this.call('execute', { code });
  }

  async callMultiple(
    calls: Array<{ method: string; params: Record<string, unknown> }>,
    delay = 350,
  ): Promise<Array<{ success: boolean; data?: unknown; error?: string }>> {
    const results: Array<{ success: boolean; data?: unknown; error?: string }> = [];

    for (const { method, params } of calls) {
      try {
        const result = await this.call(method, params);
        results.push({ success: true, data: result });
      } catch (error) {
        results.push({ success: false, error: (error as Error).message });
      }

      if (delay > 0) {
        await new Promise(r => setTimeout(r, delay));
      }
    }

    return results;
  }


  async getUser(userId: number, fields: string[] = []): Promise<VKUser | null> {
    const id = Math.abs(userId);

    if (this.userCache.has(id)) return this.userCache.get(id)!;

    const defaultFields = [
      'photo_50', 'photo_100', 'photo_200',
      'online', 'last_seen', 'city', 'status',
      'followers_count', 'bdate',
    ];

    try {
      const users = await this.call('users.get', {
        user_ids: id,
        fields: [...defaultFields, ...fields].join(','),
      }) as VKUserRaw[] | undefined;

      if (!users?.[0]) return null;

      const userInfo = this._formatUser(users[0]);
      this.userCache.set(id, userInfo);
      return userInfo;
    } catch (error) {
      console.warn('[VKify API] getUser error:', (error as Error).message);
      return null;
    }
  }

  async getUsers(userIds: number[], fields: string[] = []): Promise<VKUser[]> {
    const ids = userIds.map(id => Math.abs(id));
    const cached: VKUser[] = [];
    const toFetch: number[] = [];

    ids.forEach(id => {
      if (this.userCache.has(id)) {
        cached.push(this.userCache.get(id)!);
      } else {
        toFetch.push(id);
      }
    });

    if (toFetch.length === 0) return cached;

    try {
      const defaultFields = ['photo_50', 'photo_100', 'online', 'last_seen'];
      const users = await this.call('users.get', {
        user_ids: toFetch.join(','),
        fields: [...defaultFields, ...fields].join(','),
      }) as VKUserRaw[];

      const fetched = users.map(user => {
        const userInfo = this._formatUser(user);
        this.userCache.set(user.id, userInfo);
        return userInfo;
      });

      return [...cached, ...fetched];
    } catch (error) {
      console.warn('[VKify API] getUsers error:', (error as Error).message);
      return cached;
    }
  }

  private _formatUser(user: VKUserRaw): VKUser {
    return {
      id: user.id,
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      photo50: user.photo_50 ?? null,
      photo100: user.photo_100 ?? null,
      photo200: user.photo_200 ?? null,
      online: !!user.online,
      lastSeen: user.last_seen ?? null,
      city: user.city?.title ?? null,
      status: user.status ?? null,
      followersCount: user.followers_count ?? null,
      bdate: user.bdate ?? null,
    };
  }


  async getGroup(groupId: number, fields: string[] = []): Promise<unknown> {
    const groups = await this.call('groups.getById', {
      group_id: groupId,
      fields: fields.join(','),
    }) as unknown[] | undefined;
    return groups?.[0] ?? null;
  }


  async getFriends(userId: number | null = null, fields: string[] = [], count = 5000): Promise<unknown> {
    const params: Record<string, unknown> = { count, fields: fields.join(',') };
    if (userId) params['user_id'] = userId;
    return this.call('friends.get', params);
  }

  async addFriend(userId: number, text = ''): Promise<unknown> {
    const params: Record<string, unknown> = { user_id: userId };
    if (text) params['text'] = text;
    return this.call('friends.add', params);
  }

  async deleteFriend(userId: number): Promise<unknown> {
    return this.call('friends.delete', { user_id: userId });
  }


  async sendMessage(peerId: number, message: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.call('messages.send', {
      peer_id: peerId,
      message,
      random_id: Math.floor(Math.random() * 1000000),
      ...params,
    });
  }

  async getConversations(count = 20, offset = 0): Promise<unknown> {
    return this.call('messages.getConversations', { count, offset, extended: 1 });
  }

  async getHistory(peerId: number, count = 20, offset = 0): Promise<unknown> {
    return this.call('messages.getHistory', { peer_id: peerId, count, offset });
  }


  async getWall(ownerId: number, count = 20, offset = 0): Promise<unknown> {
    return this.call('wall.get', { owner_id: ownerId, count, offset });
  }

  async postWall(ownerId: number, message: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.call('wall.post', { owner_id: ownerId, message, ...params });
  }


  clearCache(): void {
    this.userCache.clear();
  }

  getCacheSize(): number {
    return this.userCache.size;
  }

  getCachedUser(userId: number): VKUser | null {
    return this.userCache.get(Math.abs(userId)) ?? null;
  }
}

export const vkApi = new VKApiClient();