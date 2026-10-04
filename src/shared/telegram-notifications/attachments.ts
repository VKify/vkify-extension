import { object } from '../center-tools.js';
import { isVkPhotoUrl, messagePhotos } from './photos.js';

export interface TelegramAttachment { kind: 'voice' | 'audio' | 'video' | 'document' | 'link'; url: string; title: string }
export function safeAttachmentUrl(value: unknown, media = false): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') &&
      (!media || isVkPhotoUrl(value) || ['vkuseraudio.net', 'vkuseraudio.ru', 'vkuservideo.net', 'vkuserlive.com'].some(h => u.hostname === h || u.hostname.endsWith('.' + h)));
  } catch { return false; }
}
export function normalizeAttachments(raw: unknown): TelegramAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 10).map(object).filter(a => ['voice', 'audio', 'video', 'document', 'link'].includes(String(a.kind)) && safeAttachmentUrl(a.url, a.kind !== 'link'))
    .map(a => ({ kind: a.kind as TelegramAttachment['kind'], url: String(a.url), title: String(a.title || 'Вложение').slice(0, 200) }));
}
/** Only direct attachments. Protected video and unsupported objects stay VK links. */
export function messageAttachments(raw: unknown): TelegramAttachment[] {
  const result: TelegramAttachment[] = [];
  const attachments = object(raw).attachments;
  if (!Array.isArray(attachments)) return result;
  for (const rawAttachment of attachments.slice(0, 10)) {
    const a = object(rawAttachment), type = String(a.type), value = object(a[type]);
    let kind: TelegramAttachment['kind'] = 'link', url: unknown, title = String(value.title || type);
    if (type === 'audio_message') { kind = 'voice'; url = value.link_ogg || value.link_mp3; title = 'Голосовое сообщение'; }
    else if (type === 'audio') { kind = 'audio'; url = value.url; title = [value.artist, value.title].filter(Boolean).join(' — '); }
    else if (type === 'doc') { kind = 'document'; url = value.url; }
    else if (type === 'video') { kind = 'video'; const files = object(value.files); url = files.mp4_720 || files.mp4_480 || files.mp4_360 || files.mp4_240; }
    else if (type === 'link') url = value.url;
    else if (type === 'sticker') {
      const images = value.images;
      if (Array.isArray(images)) url = [...images].map(object).reverse().find(i => safeAttachmentUrl(i.url, true))?.url;
      title = 'Стикер';
    } else if (type === 'photo' && messagePhotos({ attachments: [a] }).length) continue;
    if (!safeAttachmentUrl(url, kind !== 'link')) {
      const owner = Number(value.owner_id), id = Number(value.id);
      if (Number.isSafeInteger(owner) && owner !== 0 && Number.isSafeInteger(id) && id > 0 && /^[a-z_]+$/.test(type)) {
        kind = 'link'; url = `https://vk.ru/${type}${owner}_${id}`;
      } else { kind = 'link'; url = 'https://vk.ru/im'; }
    }
    result.push({ kind, url: String(url), title: title.slice(0, 200) });
  }
  return result;
}
