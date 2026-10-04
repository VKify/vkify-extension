import type { NotificationPayload } from './types.js';

export interface SpyNotificationInput {
  code: number;
  userId: number | string;
  userName: string;
  action: string;
  extra?: Record<string, unknown>;
}

const TYPE_BY_CODE: Readonly<Record<number, string>> = {
  52: 'spy.chat_event',
  63: 'spy.typing',
  64: 'spy.voice',
  65: 'spy.upload',
  66: 'spy.upload',
  67: 'spy.upload',
  81: 'spy.invisibility',
  90: 'spy.friend_event',
  115: 'spy.call',
  10002: 'spy.delete',
  10004: 'spy.new_message',
  10005: 'spy.edit',
  10007: 'spy.read',
  10013: 'spy.delete',
};

export function createSpyNotificationPayload(input: SpyNotificationInput): NotificationPayload {
  const type = TYPE_BY_CODE[input.code] ?? 'spy.event';
  const suffix = input.extra?.messageId
    ?? input.extra?.editTimestamp
    ?? input.extra?.timestamp
    ?? input.extra?.updateType
    ?? input.extra?.actionType
    ?? input.extra?.peerId
    ?? input.action;
  return {
    type,
    title: input.userName,
    body: ([10004, 10002, 10005].includes(input.code) && typeof input.extra?.text === 'string' && input.extra.text
      ? `${input.action}: ${input.extra.text}`
      : input.action).slice(0, 3500),
    priority: input.code === 10004 || input.code === 115 ? 'high' : 'normal',
    data: { ...input.extra, action: input.action, userId: String(input.userId), eventCode: input.code },
    dedupeKey: `${type}:${input.userId}:${suffix}`,
  };
}

export function createOnlineStatusPayload(
  userId: string,
  userName: string,
  isOnline: boolean,
): NotificationPayload {
  const type = isOnline ? 'spy.online' : 'spy.offline';
  return {
    type,
    title: userName,
    body: isOnline ? 'Зашёл в сеть' : 'Вышел из сети',
    priority: 'normal',
    data: { userId, online: isOnline },
    dedupeKey: `${type}:${userId}`,
  };
}

export interface ProfileSpyNotificationInput {
  userId: string;
  userName: string;
  changeType: 'avatar' | 'status' | 'friends_added' | 'friends_removed';
  description: string;
  before: string | number | null;
  after: string | number | null;
}

// Bound the key independently of VK CDN signatures and long profile statuses.
function profileChangeKey(input: ProfileSpyNotificationInput): string {
  let hash = 0xcbf29ce484222325n;
  for (const char of JSON.stringify([input.before, input.after])) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(char.codePointAt(0)!)) * 0x100000001b3n);
  }
  return hash.toString(16);
}

export function createProfileSpyNotificationPayload(input: ProfileSpyNotificationInput): NotificationPayload {
  const type = `spy.profile.${input.changeType}`;
  return {
    type,
    title: input.userName,
    body: input.description,
    priority: 'normal',
    data: {
      userId: input.userId,
      changeType: input.changeType,
      before: input.before,
      after: input.after,
    },
    dedupeKey: `${type}:${input.userId}:${profileChangeKey(input)}`,
  };
}

