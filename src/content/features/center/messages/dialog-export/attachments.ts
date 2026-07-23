/** Описание вложений и хелперы автора/даты/картинок, общие для всех рендеров. */

import type { AttDescriptor, PeerNames, VKAttachment, VKPhotoSize } from './types.js';
import { t } from '@/content/i18n/index.js';

export function authorName(fromId: number, names: PeerNames): string {
  if (fromId > 0) {
    const u = names.users.get(fromId);
    return u ? `${u.first_name} ${u.last_name}`.trim() : `id${fromId}`;
  }
  const g = names.groups.get(-fromId);
  return g ? g.name : `club${-fromId}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Самая большая по площади картинка из массива размеров. */
export function pickLargest(sizes: VKPhotoSize[] | undefined): VKPhotoSize | null {
  if (!sizes?.length) return null;
  let best = sizes[0];
  for (const s of sizes) {
    if ((s.width * s.height) > (best.width * best.height)) best = s;
  }
  return best;
}

export function describeAttachment(att: VKAttachment): AttDescriptor {
  const empty: AttDescriptor = { textLine: '', imageUrl: null, link: null, htmlLabel: '' };

  switch (att.type) {
    case 'photo': {
      const s = pickLargest(att.photo?.sizes);
      const url = s?.url ?? null;
      const photo = t('messages.export.att.photo');
      return {
        textLine: url ? `📷 ${photo}: ${url}` : `📷 ${photo}`,
        imageUrl: url,
        link: url,
        htmlLabel: `📷 ${photo}`,
      };
    }
    case 'sticker': {
      const s = pickLargest(att.sticker?.images_with_background ?? att.sticker?.images);
      const sticker = `🎨 ${t('messages.export.att.sticker')}`;
      return {
        textLine: sticker,
        imageUrl: s?.url ?? null,
        link: null,
        htmlLabel: sticker,
      };
    }
    case 'doc': {
      const d = att.doc;
      const label = d?.title || `${t('messages.export.att.doc')}${d?.ext ? '.' + d.ext : ''}`;
      return {
        textLine: d?.url ? `📎 ${label}: ${d.url}` : `📎 ${label}`,
        imageUrl: null,
        link: d?.url ?? null,
        htmlLabel: `📎 ${label}`,
      };
    }
    case 'audio': {
      const a = att.audio;
      const label = `${a?.artist ?? ''} — ${a?.title ?? ''}`.trim().replace(/^—\s*|\s*—$/g, '');
      const audioLabel = label || t('messages.export.att.audio');
      return {
        textLine: `🎵 ${audioLabel}`,
        imageUrl: null,
        link: a?.url ?? null,
        htmlLabel: `🎵 ${audioLabel}`,
      };
    }
    case 'audio_message': {
      const a = att.audio_message;
      const url = a?.link_mp3 ?? a?.link_ogg ?? null;
      const voice = t('messages.export.att.voice');
      return {
        textLine: url ? `🎤 ${voice}: ${url}` : `🎤 ${voice}`,
        imageUrl: null,
        link: url,
        htmlLabel: `🎤 ${t('messages.export.att.voice_msg')}`,
      };
    }
    case 'video': {
      const v = att.video;
      const title = v?.title || t('messages.export.att.video');
      const ownerId = v?.owner_id, vid = v?.id;
      const pageUrl = ownerId && vid ? `https://vk.ru/video${ownerId}_${vid}` : null;
      return {
        textLine: pageUrl ? `🎬 ${title}: ${pageUrl}` : `🎬 ${title}`,
        imageUrl: null,
        link: pageUrl,
        htmlLabel: `🎬 ${title}`,
      };
    }
    case 'link': {
      const l = att.link;
      const label = l?.title || l?.url || t('messages.export.att.link');
      return {
        textLine: l?.url ? `🔗 ${label}: ${l.url}` : `🔗 ${label}`,
        imageUrl: null,
        link: l?.url ?? null,
        htmlLabel: `🔗 ${label}`,
      };
    }
    case 'wall':
    case 'wall_reply':
    case 'gift':
    case 'graffiti':
    case 'market':
    case 'poll':
    case 'call':
    default:
      return {
        ...empty,
        textLine: `[${att.type}]`,
        htmlLabel: `📌 ${att.type}`,
      };
  }
}

/** Подменяет URL картинки во всех размерах вложения (на data:URL или путь в архиве). */
export function injectDataUrl(att: VKAttachment, originalUrl: string, dataUrl: string): void {
  const findAndReplace = (sizes?: VKPhotoSize[]): void => {
    if (!sizes) return;
    for (const s of sizes) {
      if (s.url === originalUrl) s.url = dataUrl;
    }
  };
  findAndReplace(att.photo?.sizes);
  findAndReplace(att.sticker?.images);
  findAndReplace(att.sticker?.images_with_background);
}
