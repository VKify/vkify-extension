/**
 * Билдеры параметров для ходовых VK-методов и наборы полей по умолчанию.
 * Общие для всех контекстов (content / popup / background) — чтобы способ
 * собрать `users.get` или `messages.send` не дублировался тремя копиями.
 */

/** Полный набор полей юзера (профильные карточки, текущий пользователь). */
export const DEFAULT_USER_FIELDS = [
  'photo_50', 'photo_100', 'photo_200',
  'online', 'last_seen', 'city', 'status',
  'followers_count', 'bdate',
] as const;

/** Минимальный набор полей для пакетных users.get (списки, аватарки). */
export const BASIC_USER_FIELDS = ['photo_50', 'photo_100', 'online', 'last_seen'] as const;

/** random_id обязателен для messages.send с API v5.90+ (идемпотентность). */
export function randomId(max = 1_000_000_000): number {
  return Math.floor(Math.random() * max);
}

/** Параметры messages.send: peer_id + текст + random_id + произвольные доп-поля. */
export function buildSendMessage(
  peerId: number | string,
  message: string,
  params: Record<string, unknown> = {},
): Record<string, unknown> {
  return { peer_id: peerId, message, random_id: randomId(), ...params };
}

/** Параметры users.get: нормализует список id и поля в CSV-строки. */
export function buildUsersGet(
  userIds: number | string | Array<number | string>,
  fields: readonly string[] = [],
): Record<string, unknown> {
  return {
    user_ids: Array.isArray(userIds) ? userIds.join(',') : userIds,
    fields: fields.join(','),
  };
}
