import type { NoteAttachment } from '@/types/index.js';
import { attachmentType } from '@/shared/notes.js';
import { object, safeUrl } from '@/shared/center-tools.js';
import type { VKMessage } from '../dialog-export/types.js';

function largest(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  return value.map(object).filter(s => safeUrl(s.url ?? s.src))
    .sort((a, b) => Number(b.width) * Number(b.height) - Number(a.width) * Number(a.height))
    .map(s => safeUrl(s.url ?? s.src))[0] ?? null;
}

/** VK supplies direct file URLs even when its DOM player has no src. */
export function messageAttachments(message: VKMessage, messageUrl?: string, depth = 0): NoteAttachment[] {
  if (depth > 10) return [];
  const result: NoteAttachment[] = [];
  for (const attachment of message.attachments ?? []) {
    const media = object(attachment[attachment.type]);
    let type: NoteAttachment['type'] = 'link';
    let url = safeUrl(media.url);
    let title = typeof media.title === 'string' ? media.title : undefined;
    switch (attachment.type) {
      case 'photo': type = 'image'; url = largest(media.sizes); break;
      case 'sticker': type = 'image'; url = largest(media.images_with_background) ?? largest(media.images); break;
      case 'graffiti': type = 'image'; break;
      case 'audio_message': type = 'voice'; url = safeUrl(media.link_mp3) ?? safeUrl(media.link_ogg); break;
      case 'audio': type = 'audio'; title = [media.artist, media.title].filter(v => typeof v === 'string' && v).join(' — ') || undefined; break;
      case 'doc':
        type = typeof media.ext === 'string' && /^[a-z0-9]+$/i.test(media.ext)
          ? attachmentType(`https://file.invalid/file.${media.ext}`) : url ? attachmentType(url) : 'file';
        break;
      case 'video':
        // A VK video page is a link, not a file playable by <video>.
        if (!url && Number.isSafeInteger(media.owner_id) && Number.isSafeInteger(media.id)) {
          url = `https://vk.ru/video${media.owner_id}_${media.id}`;
        }
        type = url && attachmentType(url) === 'video' ? 'video' : 'link';
        break;
    }
    // Unsupported or unavailable media stays reachable via the source message.
    if (!url && messageUrl) { url = messageUrl; type = 'link'; title ??= attachment.type; }
    if (url) result.push({ type, url, ...(title ? { title } : {}) });
  }
  for (const forwarded of message.fwd_messages ?? []) {
    result.push(...messageAttachments(forwarded, messageUrl, depth + 1));
  }
  if (message.reply_message) result.push(...messageAttachments(message.reply_message, messageUrl, depth + 1));
  return result;
}

/** DOM fallback deliberately excludes sender avatars and document thumbnails. */
export function domAttachments(block: Element): NoteAttachment[] {
  const result: NoteAttachment[] = [];
  const seen = new Set<string>();
  const add = (type: NoteAttachment['type'], raw: string | null, title?: string): void => {
    if (!raw) return;
    let url: string | null = null;
    try { url = safeUrl(new URL(raw, location.origin).href); } catch { /* Invalid attribute. */ }
    if (!url || seen.has(url)) return;
    seen.add(url);
    result.push({ type, url, ...(title ? { title } : {}) });
  };
  for (const container of block.querySelectorAll('.Attachments, [class*="__mediaAttachments"], [class*="__attachments"]')) {
    container.querySelectorAll<HTMLImageElement>('img').forEach(img => {
      if (!img.closest('a.AttachDocPreview')) add('image', img.currentSrc || img.getAttribute('src'), img.alt);
    });
    container.querySelectorAll('audio, video').forEach(media => {
      const src = media.getAttribute('src') || media.querySelector('source')?.getAttribute('src') || null;
      add(media.tagName === 'AUDIO' ? 'audio' : 'video', src);
    });
    container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
      if (anchor.matches('.AttachPhotos__link') || (anchor.querySelector('img') && !anchor.matches('.AttachDocPreview'))) return;
      add(anchor.matches('.AttachDocPreview') ? 'file' : 'link', anchor.getAttribute('href'),
        anchor.querySelector('img')?.alt || anchor.textContent?.trim() || undefined);
    });
  }
  return result;
}
