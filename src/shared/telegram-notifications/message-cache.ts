import { object } from '../center-tools.js';
import { isVkPhotoUrl, messagePhotos } from './photos.js';
import { messageAttachments, normalizeAttachments, type TelegramAttachment } from './attachments.js';

export interface CachedSpyMessage {
  peerId: number; cmid: number; text: string; photos: string[]; attachments?: TelegramAttachment[]; savedAt: number;
}
export const SPY_MESSAGE_CACHE_KEY = 'spy_message_cache';
export const messageCacheKey = (peerId: number, cmid: number) => `${peerId}:${cmid}`;

export function normalizeCachedMessage(raw: unknown): CachedSpyMessage | null {
  const m = object(raw);
  const peerId = Number(m.peerId), cmid = Number(m.cmid);
  if (!Number.isSafeInteger(peerId) || peerId <= 0 || peerId >= 2_000_000_000 || !Number.isSafeInteger(cmid) || cmid <= 0) return null;
  return { peerId, cmid, text: typeof m.text === 'string' ? m.text.slice(0, 3500) : '',
    photos: Array.isArray(m.photos) ? m.photos.filter(isVkPhotoUrl).slice(0, 10) : [], attachments: Array.isArray(m.attachments) ? normalizeAttachments(m.attachments) : undefined, savedAt: Date.now() };
}

/** Cache direct incoming messages only. Do not overwrite originals with deletion tombstones. */
export function cacheableApiMessage(raw: unknown): CachedSpyMessage | null {
  const m = object(raw), peer = Number(m.peer_id);
  if (m.out === 1 || m.out === true || m.deleted || Number(m.from_id) !== peer) return null;
  return normalizeCachedMessage({ peerId: peer, cmid: m.conversation_message_id, text: m.text, photos: messagePhotos(m), attachments: messageAttachments(m) });
}

export function cachedLongPollMessage(update: unknown[]): CachedSpyMessage | null {
  const code = update[0];
  if (code !== 10004 && code !== 10005 || Number(update[2]) & 2) return null;
  const attachments = update[code === 10004 ? 8 : 7] as { attachments?: string } | undefined;
  let photos: string[] = [];
  try { if (attachments?.attachments) photos = messagePhotos({ attachments: JSON.parse(attachments.attachments) }); } catch { /* optional attachment JSON */ }
  return normalizeCachedMessage({ peerId: update[code === 10004 ? 4 : 3], cmid: update[1], text: update[code === 10004 ? 6 : 5], photos });
}

/** Known message response containers, rather than recursively reading arbitrary API data. */
export function cachedMessagesFromResponse(raw: unknown): CachedSpyMessage[] {
  const r = object(object(raw).response ?? raw);
  const messages = object(r.messages);
  const items = Array.isArray(r.items) ? r.items : Array.isArray(messages.items) ? messages.items : [];
  return items.map(cacheableApiMessage).filter((m): m is CachedSpyMessage => m !== null);
}
