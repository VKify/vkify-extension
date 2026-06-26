/**
 * Типовая карта популярных VK-методов: имя метода → { params; response }.
 *
 * Параметры намеренно остаются `Record<string, unknown>` (VK-методы принимают
 * десятки опциональных полей — строгий интерфейс ловил бы excess-property на
 * литералах и мешал бы вызывающим). Ценность карты — автодополнение имён
 * методов и типизация ответа у `VKApiService.call(...)`. Произвольные методы
 * (не в карте) доступны через строковый overload `call(method, params)`.
 */

import type { VKUserRaw, VKFriendsResponse } from '@/types/index.js';

export interface ResolveScreenNameResponse {
  type?: 'user' | 'group' | 'page' | 'application' | string;
  object_id?: number;
}

export interface AudioUploadServer {
  upload_url?: string;
}

type Method<R> = { params: Record<string, unknown>; response: R };

export interface VkApiMethods {
  'users.get':                 Method<VKUserRaw[]>;
  'friends.get':               Method<VKFriendsResponse>;
  'friends.add':               Method<number>;
  'friends.delete':            Method<unknown>;
  'groups.getById':            Method<unknown[]>;
  'messages.send':             Method<number>;
  'messages.getHistory':       Method<unknown>;
  'messages.getConversations': Method<unknown>;
  'wall.get':                  Method<unknown>;
  'wall.post':                 Method<unknown>;
  'photos.get':                Method<unknown>;
  'photos.getById':            Method<unknown>;
  'video.get':                 Method<unknown>;
  'stories.getById':           Method<unknown>;
  'audio.getUploadServer':     Method<AudioUploadServer>;
  'audio.save':                Method<unknown>;
  'utils.resolveScreenName':   Method<ResolveScreenNameResponse>;
  'execute':                   Method<unknown>;
}

export type VkApiMethodName = keyof VkApiMethods;
