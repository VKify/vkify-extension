/**
 * VKApiService — единая точка всех VK API-вызовов в content-скрипте.
 *
 * Регистрируется в ServiceContainer (SERVICES.vkApi) и торчит наружу как
 * `ctx.vkApi`. Хелпер-модули без ctx берут его через getService(SERVICES.vkApi).
 *
 * Слои:
 *   • low-level   — call(method, params): очередь → native-bridge → token-fallback.
 *   • high-level  — getCurrentUser / getUser / sendMessage / uploadAudio / … —
 *                   единственная копия удобных методов (раньше дублировались).
 *
 * Транспорт (native-bridge ↔ token-fetch) вынесен в transport.ts, очередь и
 * retry — в rate-limiter.ts. Маппинг юзера, билдеры параметров и типы методов —
 * в shared/vk (общие с popup/background).
 */

import type { VKUser, VKUserRaw } from '@/types/index.js';
import { fetchVKMethod, isVKTokenError } from '@/shared/utils/vk-fetch.js';
import { TtlCache } from '@/shared/utils/ttl-cache.js';
import { perfCollector } from '../perf/collector.js';
import { formatUser } from '@/shared/vk/user.js';
import {
  buildSendMessage, buildUsersGet,
  DEFAULT_USER_FIELDS, BASIC_USER_FIELDS,
} from '@/shared/vk/params.js';
import type { VkApiMethods, ResolveScreenNameResponse } from '@/shared/vk/methods.js';
import { BridgeTransport } from './transport.js';
import { ApiQueue } from './rate-limiter.js';

const DEV = import.meta.env.DEV;

export class VKApiService {
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;
  private readonly userCache = new TtlCache<number, VKUser>();

  private readonly transport = new BridgeTransport();
  private readonly queue = new ApiQueue();

  /** Доступен ли нативный мост (через page-world `vkApi.api`). */
  get nativeApiAvailable(): boolean {
    return this.transport.available;
  }

  /** Per-session nonce канала с инжектированным мостом (ставит VKifyApp). */
  setChannelNonce(nonce: string): void {
    this.transport.setChannelNonce(nonce);
  }

  // ── Токен ─────────────────────────────────────────────────────────────────

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

  // ── Low-level ─────────────────────────────────────────────────────────────

  /** Типизированный вызов известного метода (см. VkApiMethods). */
  call<M extends keyof VkApiMethods>(method: M, params?: VkApiMethods[M]['params']): Promise<VkApiMethods[M]['response']>;
  /** Произвольный метод (вне карты) — ответ `unknown`. */
  call(method: string, params?: Record<string, unknown>): Promise<unknown>;
  call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    // Через очередь: лимит параллелизма + retry на flood-ошибках.
    return this.queue.run(() => this._dispatch(method, params));
  }

  private async _dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    perfCollector.recordApiCall();
    if (DEV) console.debug('[vkApi] →', method, params);

    try {
      // 1) Native-bridge first (сам падает на token внутри при fallbackToToken/таймауте).
      if (this.transport.available) {
        try {
          const data = await this.transport.call(method, params, () => this._callWithToken(method, params));
          if (DEV) console.debug('[vkApi] ←', method, data);
          return data;
        } catch (error) {
          if (DEV) console.warn(`[vkApi] native failed for ${method}, trying token:`, (error as Error).message);
        }
      }
      // 2) Token-fetch.
      const data = await this._callWithToken(method, params);
      if (DEV) console.debug('[vkApi] ←', method, data);
      return data;
    } catch (error) {
      if (DEV) console.debug('[vkApi] ✗', method, (error as Error).message);
      throw error;
    }
  }

  private async _callWithToken(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.hasToken()) throw new Error('No access token available');

    try {
      return await fetchVKMethod(method, this.token!, params);
    } catch (error) {
      // Невалидный/протухший токен → сбрасываем, чтобы следующий вызов переполучил.
      if (isVKTokenError(error)) this.clearToken();
      console.error(`[VKify API] ${method} error:`, error);
      throw error;
    }
  }

  /** Сахар над методом `execute` (VKScript-батч в один запрос). */
  async execute(code: string): Promise<unknown> {
    return this.call('execute', { code });
  }

  /**
   * Последовательно выполняет список вызовов с паузой между ними (rate-limit) и
   * возвращает per-call результат `{ success, data | error }` — ошибка одного
   * вызова не роняет остальные.
   */
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

  // ── High-level: пользователи ──────────────────────────────────────────────

  /** Текущий пользователь (владелец токена) — users.get без user_ids. */
  async getCurrentUser(fields: string[] = []): Promise<VKUser | null> {
    try {
      const users = await this.call('users.get', {
        fields: [...DEFAULT_USER_FIELDS, ...fields].join(','),
      });
      const raw = users?.[0];
      if (!raw) return null;

      const userInfo = formatUser(raw);
      this.userCache.set(userInfo.id, userInfo);
      return userInfo;
    } catch (error) {
      console.warn('[VKify API] getCurrentUser error:', (error as Error).message);
      return null;
    }
  }

  /** Один пользователь (camelCase VKUser) с кэшированием; null при ошибке/отсутствии. */
  async getUser(userId: number, fields: string[] = []): Promise<VKUser | null> {
    const id = Math.abs(userId);

    if (this.userCache.has(id)) return this.userCache.get(id)!;

    try {
      const users = await this.call('users.get', buildUsersGet(id, [...DEFAULT_USER_FIELDS, ...fields]));
      if (!users?.[0]) return null;

      const userInfo = formatUser(users[0]);
      this.userCache.set(id, userInfo);
      return userInfo;
    } catch (error) {
      console.warn('[VKify API] getUser error:', (error as Error).message);
      return null;
    }
  }

  /** Пакетный users.get: отдаёт кэшированных сразу, дозапрашивает остальных одним вызовом. */
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
      const users = await this.call('users.get', buildUsersGet(toFetch, [...BASIC_USER_FIELDS, ...fields]));

      const fetched = users.map(user => {
        const userInfo = formatUser(user);
        this.userCache.set(user.id, userInfo);
        return userInfo;
      });

      return [...cached, ...fetched];
    } catch (error) {
      console.warn('[VKify API] getUsers error:', (error as Error).message);
      return cached;
    }
  }

  // ── High-level: группы / друзья ───────────────────────────────────────────

  /** Одно сообщество (groups.getById); null, если не вернулось. */
  async getGroup(groupId: number, fields: string[] = []): Promise<unknown> {
    const groups = await this.call('groups.getById', {
      group_id: groupId,
      fields: fields.join(','),
    });
    return groups?.[0] ?? null;
  }

  /** Список друзей (свой при userId=null). */
  async getFriends(userId: number | null = null, fields: string[] = [], count = 5000): Promise<unknown> {
    const params: Record<string, unknown> = { count, fields: fields.join(',') };
    if (userId) params['user_id'] = userId;
    return this.call('friends.get', params);
  }

  /** Заявка в друзья / подтверждение (friends.add), с опциональным сопроводительным текстом. */
  async addFriend(userId: number, text = ''): Promise<unknown> {
    const params: Record<string, unknown> = { user_id: userId };
    if (text) params['text'] = text;
    return this.call('friends.add', params);
  }

  /** Удаление из друзей / отклонение заявки (friends.delete). */
  async deleteFriend(userId: number): Promise<unknown> {
    return this.call('friends.delete', { user_id: userId });
  }

  // ── High-level: сообщения ─────────────────────────────────────────────────

  /** Отправка сообщения в диалог: подставляет обязательный random_id (идемпотентность). */
  async sendMessage(peerId: number, message: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.call('messages.send', buildSendMessage(peerId, message, params));
  }

  /** Страница списка бесед (extended=1 — с профилями/группами). */
  async getConversations(count = 20, offset = 0): Promise<unknown> {
    return this.call('messages.getConversations', { count, offset, extended: 1 });
  }

  /** Страница истории сообщений диалога. */
  async getHistory(peerId: number, count = 20, offset = 0): Promise<unknown> {
    return this.call('messages.getHistory', { peer_id: peerId, count, offset });
  }

  // ── High-level: стена ─────────────────────────────────────────────────────

  /** Страница записей со стены владельца (ownerId<0 — сообщество). */
  async getWall(ownerId: number, count = 20, offset = 0): Promise<unknown> {
    return this.call('wall.get', { owner_id: ownerId, count, offset });
  }

  /** Публикация записи на стену владельца. */
  async postWall(ownerId: number, message: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.call('wall.post', { owner_id: ownerId, message, ...params });
  }

  // ── High-level: утилиты / загрузка ────────────────────────────────────────

  /** utils.resolveScreenName — сырой результат {type, object_id} (маппинг в
   *  peer-id оставлен вызывающей стороне, т.к. зависит от домена). */
  async resolveScreenName(screenName: string): Promise<ResolveScreenNameResponse | null> {
    return (await this.call('utils.resolveScreenName', { screen_name: screenName })) ?? null;
  }

  /**
   * Загрузка одного аудио: audio.getUploadServer → POST на upload-сервер →
   * audio.save. FormData получает ASCII-имя «audio.mp3» (исключаем кракозябры),
   * метаданные идут через audio.save (UTF-8). `onStage` — для UI-прогресса.
   */
  async uploadAudio(
    file: File,
    meta: { artist?: string; title?: string } = {},
    onStage?: (stage: 'server' | 'upload' | 'save') => void,
  ): Promise<unknown> {
    onStage?.('server');
    const server = await this.call('audio.getUploadServer', {});
    const uploadUrl = server?.upload_url;
    if (!uploadUrl) throw new Error('Не удалось получить URL загрузки');

    onStage?.('upload');
    const form = new FormData();
    form.append('file', file, 'audio.mp3');
    const uploadResp = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!uploadResp.ok) throw new Error(`HTTP ${uploadResp.status}`);
    const uploaded = await uploadResp.json() as { server?: number; audio?: string; hash?: string };
    if (!uploaded?.audio) throw new Error('Пустой ответ от VK upload-сервера');

    onStage?.('save');
    return this.call('audio.save', {
      server: uploaded.server,
      audio:  uploaded.audio,
      hash:   uploaded.hash,
      artist: meta.artist ?? '',
      title:  meta.title ?? '',
    });
  }

  // ── Кэш юзеров ────────────────────────────────────────────────────────────

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

/** Глобальный singleton content-скрипта (регистрируется в ServiceContainer). */
export const vkApiService = new VKApiService();
