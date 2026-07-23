/** Скачивание картинок: base64-эмбеддинг (HTML+) и сборка ZIP-архива с фото. */

import { buildZip, type ZipEntry } from '@/shared/utils/zip.js';
import { EMBED_CONCURRENCY, EMBED_MAX_BYTES } from './constants.js';
import { describeAttachment, injectDataUrl } from './attachments.js';
import { buildHtml } from './render.js';
import type { ConversationExportMeta, PeerNames, VKMessage } from './types.js';

interface EmbeddedImage {
  dataUrl: string;
  byteLength: number;
}

async function fetchAsDataUrl(url: string): Promise<EmbeddedImage | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;

    const lenHdr = Number(res.headers.get('content-length') || '0');
    if (lenHdr > EMBED_MAX_BYTES) return null;

    const blob = await res.blob();
    if (blob.size > EMBED_MAX_BYTES) return null;

    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    return dataUrl ? { dataUrl, byteLength: blob.size } : null;
  } catch {
    // CORS / сеть / экстеншен-context: оставляем прямую ссылку
    return null;
  }
}

interface EmbedTarget {
  url: string;
  apply: (dataUrl: string) => void;
}

async function embedTargets(
  targets: EmbedTarget[],
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
  maxTotalBytes = Number.POSITIVE_INFINITY,
): Promise<void> {
  const grouped = new Map<string, Array<(dataUrl: string) => void>>();
  for (const target of targets) {
    const apply = grouped.get(target.url);
    if (apply) apply.push(target.apply);
    else grouped.set(target.url, [target.apply]);
  }
  const uniqueTargets = Array.from(grouped, ([url, apply]) => ({ url, apply }));
  const total = uniqueTargets.length;
  onProgress(0, total);
  if (total === 0) return;

  let next = 0;
  let done = 0;
  let embeddedBytes = 0;
  const workers = Array.from({ length: Math.min(EMBED_CONCURRENCY, total) }, async () => {
    while (next < total) {
      if (isCancelled()) return;
      const target = uniqueTargets[next++];
      const embedded = await fetchAsDataUrl(target.url);
      if (embedded && embeddedBytes + embedded.byteLength <= maxTotalBytes) {
        embeddedBytes += embedded.byteLength;
        for (const apply of target.apply) apply(embedded.dataUrl);
      }
      onProgress(++done, total);
    }
  });
  await Promise.all(workers);
}

function collectAttachmentTargets(messages: VKMessage[]): EmbedTarget[] {
  const targets: EmbedTarget[] = [];
  function walk(m: VKMessage): void {
    for (const att of m.attachments ?? []) {
      const url = describeAttachment(att).imageUrl;
      if (url) targets.push({ url, apply: dataUrl => injectDataUrl(att, url, dataUrl) });
    }
    if (m.reply_message) walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) walk(f);
  }
  for (const m of messages) walk(m);
  return targets;
}

function collectAuthorIds(messages: VKMessage[]): Set<number> {
  const ids = new Set<number>();
  function walk(message: VKMessage): void {
    ids.add(message.from_id);
    if (message.reply_message) walk(message.reply_message);
    for (const forwarded of message.fwd_messages ?? []) walk(forwarded);
  }
  for (const message of messages) walk(message);
  return ids;
}

/** Для HTML+/PDF встраивает превью вложений и аватары участников. */
export async function embedChatImages(
  messages: VKMessage[],
  names: PeerNames,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
  maxTotalBytes?: number,
): Promise<void> {
  const targets = collectAttachmentTargets(messages);
  const authorIds = collectAuthorIds(messages);

  for (const profile of names.users.values()) {
    const url = profile.photo_100;
    if (url && authorIds.has(profile.id)) {
      targets.push({ url, apply: dataUrl => { profile.photo_100 = dataUrl; } });
    }
  }
  for (const group of names.groups.values()) {
    const url = group.photo_100;
    if (url && authorIds.has(-group.id)) {
      targets.push({ url, apply: dataUrl => { group.photo_100 = dataUrl; } });
    }
  }
  await embedTargets(targets, onProgress, isCancelled, maxTotalBytes);
}

/** Расширение для имени файла, выводимое из Content-Type ответа. */
function extFromMime(mime: string | null): string {
  if (!mime) return 'jpg';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png'))  return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif'))  return 'gif';
  return 'jpg';
}

export async function buildZipArchive(
  title: string,
  messages: VKMessage[],
  names: PeerNames,
  meta: ConversationExportMeta,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<Blob> {
  // Картинкам присваиваются позиционные имена photos/0001.jpg…, и эти
  // относительные пути подменяют URL в attachments — HTML возьмёт их как есть.
  interface ImgJob { originalUrl: string; localPath: string; apply: (path: string) => void; }
  const jobs: ImgJob[] = [];

  function walk(m: VKMessage): void {
    for (const a of m.attachments ?? []) {
      const d = describeAttachment(a);
      if (d.imageUrl) {
        const idx = jobs.length + 1;
        const localPath = `photos/${String(idx).padStart(4, '0')}`;
        jobs.push({
          originalUrl: d.imageUrl,
          localPath,
          apply: path => injectDataUrl(a, d.imageUrl!, path),
        });
      }
    }
    if (m.reply_message) walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) walk(f);
  }
  for (const m of messages) walk(m);

  const authorIds = collectAuthorIds(messages);
  for (const profile of names.users.values()) {
    if (!profile.photo_100 || !authorIds.has(profile.id)) continue;
    const url = profile.photo_100;
    jobs.push({
      originalUrl: url,
      localPath: `avatars/user_${profile.id}`,
      apply: path => { profile.photo_100 = path; },
    });
  }
  for (const group of names.groups.values()) {
    if (!group.photo_100 || !authorIds.has(-group.id)) continue;
    const url = group.photo_100;
    jobs.push({
      originalUrl: url,
      localPath: `avatars/group_${group.id}`,
      apply: path => { group.photo_100 = path; },
    });
  }

  const entries: ZipEntry[] = [];
  const total = jobs.length;
  onProgress(0, total);

  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(EMBED_CONCURRENCY, total) }, async () => {
    while (next < total) {
      if (isCancelled()) return;
      const i = next++;
      const job = jobs[i];

      try {
        const res = await fetch(job.originalUrl, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) { onProgress(++done, total); continue; }

        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length > EMBED_MAX_BYTES) { onProgress(++done, total); continue; }

        const ext = extFromMime(res.headers.get('content-type'));
        const fullPath = `${job.localPath}.${ext}`;
        entries.push({ name: fullPath, data: buf });
        job.apply(fullPath);
      } catch {
        // CORS / сеть — пропускаем картинку, не ломая весь экспорт.
      }
      onProgress(++done, total);
    }
  });
  await Promise.all(workers);

  const html = buildHtml(title, messages, names, meta);
  entries.unshift({ name: 'index.html', data: html });

  return buildZip(entries);
}
