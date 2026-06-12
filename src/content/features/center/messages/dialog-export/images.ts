/** Скачивание картинок: base64-эмбеддинг (HTML+) и сборка ZIP-архива с фото. */

import { buildZip, type ZipEntry } from '../../../../../shared/utils/zip.js';
import { EMBED_CONCURRENCY, EMBED_MAX_BYTES } from './constants.js';
import { describeAttachment, injectDataUrl } from './attachments.js';
import { buildHtml } from './render.js';
import type { PeerNames, VKAttachment, VKMessage } from './types.js';

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;

    const lenHdr = Number(res.headers.get('content-length') || '0');
    if (lenHdr > EMBED_MAX_BYTES) return null;

    const blob = await res.blob();
    if (blob.size > EMBED_MAX_BYTES) return null;

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // CORS / сеть / экстеншен-context: оставляем прямую ссылку
    return null;
  }
}

/** Заменяет все imageUrl вложений (включая reply/fwd) на data:URL. */
export async function embedAllImages(
  messages: VKMessage[],
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const targets: VKAttachment[] = [];
  function walk(m: VKMessage): void {
    for (const a of m.attachments ?? []) {
      const d = describeAttachment(a);
      if (d.imageUrl) targets.push(a);
    }
    if (m.reply_message) walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) walk(f);
  }
  for (const m of messages) walk(m);

  const total = targets.length;
  onProgress(0, total);
  if (total === 0) return;

  // Воркеры тянут задачи из общей очереди по EMBED_CONCURRENCY параллельно.
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(EMBED_CONCURRENCY, total) }, async () => {
    while (next < total) {
      if (isCancelled()) return;
      const i = next++;
      const att = targets[i];
      const d = describeAttachment(att);
      const url = d.imageUrl;
      if (!url) { onProgress(++done, total); continue; }

      const dataUrl = await fetchAsDataUrl(url);
      // Подмена url прямо в attachment — describeAttachment дальше вернёт data:URL.
      if (dataUrl) injectDataUrl(att, url, dataUrl);
      onProgress(++done, total);
    }
  });
  await Promise.all(workers);
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
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<Blob> {
  // Картинкам присваиваются позиционные имена photos/0001.jpg…, и эти
  // относительные пути подменяют URL в attachments — HTML возьмёт их как есть.
  interface ImgJob { att: VKAttachment; originalUrl: string; localPath: string; }
  const jobs: ImgJob[] = [];

  function walk(m: VKMessage): void {
    for (const a of m.attachments ?? []) {
      const d = describeAttachment(a);
      if (d.imageUrl) {
        const idx = jobs.length + 1;
        const localPath = `photos/${String(idx).padStart(4, '0')}`;
        jobs.push({ att: a, originalUrl: d.imageUrl, localPath });
      }
    }
    if (m.reply_message) walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) walk(f);
  }
  for (const m of messages) walk(m);

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
        injectDataUrl(job.att, job.originalUrl, fullPath);
      } catch {
        // CORS / сеть — пропускаем картинку, не ломая весь экспорт.
      }
      onProgress(++done, total);
    }
  });
  await Promise.all(workers);

  const html = buildHtml(title, messages, names);
  entries.unshift({ name: 'index.html', data: html });

  return buildZip(entries);
}
