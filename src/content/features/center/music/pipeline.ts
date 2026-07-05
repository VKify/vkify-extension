/** Полный конвейер одного трека: URL → HLS → MP3/AAC → (ID3) → файл/байты. */

import { requestUrl } from './ipc.js';
import { getDownloadSettings, buildFilename } from './settings.js';
import { buildMeta, buildId3Tag } from './meta.js';
import { fetchAndEncode, fetchOriginal } from './encoder.js';
import type { TrackEntry } from './types.js';

/** Результат конвейера: части файла + расширение и MIME для сохранения. */
export interface TrackFile {
  filename: string;
  parts: BlobPart[];
  ext: string;
  mime: string;
}

/**
 * Полный конвейер одного трека. Формат — из настроек:
 *  • `mp3`      — конвертация lamejs + ID3-теги/обложка (`.mp3`);
 *  • `original` — AAC без перекодирования, быстро и без потерь (`.m4a`, без тегов).
 */
export async function produceTrack(
  entry: TrackEntry,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<TrackFile> {
  if (signal?.aborted) throw new DOMException('Отменено', 'AbortError');

  let url = entry.cachedUrl ?? '';
  if (!url) {
    url = await requestUrl(entry);
    if (url) entry.cachedUrl = url;
  }
  if (!url) throw new Error('Ссылка недоступна');

  const cfg = await getDownloadSettings();
  const filename = buildFilename(entry.performer, entry.title, cfg.filenameFormat);

  // «Оригинальный»: отдаём ремукс AAC как есть. ID3-теги (MP3-only) пропускаем —
  // MP4-контейнер несовместим с ID3-префиксом.
  if (cfg.format === 'original') {
    const parts = await fetchOriginal(url, onProgress, signal);
    return { filename, parts, ext: 'm4a', mime: 'audio/mp4' };
  }

  const metaPromise = buildMeta(entry, cfg); // обложка/текст параллельно с потоком
  const mp3Parts = await fetchAndEncode(url, cfg.bitrate, onProgress, signal);
  const meta = await metaPromise;

  const parts: BlobPart[] = meta
    ? [new Uint8Array(buildId3Tag(meta)), ...mp3Parts]
    : mp3Parts;

  return { filename, parts, ext: 'mp3', mime: 'audio/mpeg' };
}

/** Склеивает части MP3 в один Uint8Array (для упаковки в ZIP). */
export function partsToBytes(parts: BlobPart[]): Uint8Array {
  const arrs = parts as Uint8Array[];
  const len = arrs.reduce((s, a) => s + a.byteLength, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.byteLength; }
  return out;
}

export function triggerDownload(parts: BlobPart[], filename: string, mime = 'audio/mpeg'): void {
  const blob    = new Blob(parts, { type: mime });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
