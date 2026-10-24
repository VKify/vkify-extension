/** Полный конвейер одного трека: URL → HLS → MP3/AAC → (ID3) → файл/байты. */

import { requestTrackInfo, requestUrl } from './ipc.js';
import { decodeHtmlEntities } from '@/content/utils/decode-html-entities.js';
import { tupleArtwork } from '@/shared/music-artwork.js';
import { getDownloadSettings, buildFilename } from './settings.js';
import { buildMeta, buildId3Tag } from './meta.js';
import { fetchAndEncode, fetchOriginal } from './encoder.js';
import type { TrackEntry } from './types.js';
import { t } from '@/content/i18n/index.js';

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
 *  • `original` — исходное аудио без перекодирования и добавления метаданных.
 */
export async function produceTrack(
  entry: TrackEntry,
  onProgress: (s: string) => void,
  signal?: AbortSignal,
): Promise<TrackFile> {
  if (signal?.aborted) throw new DOMException(t('music.cancelled'), 'AbortError');

  const cfg = await getDownloadSettings();
  entry.coverUrl = tupleArtwork(entry.audioData) || entry.coverUrl;
  // Bulk entries can contain only an ID or incomplete playlist metadata.
  if (!entry.cachedUrl || (cfg.format === 'mp3' && cfg.id3 && !entry.coverUrl)) {
    // Slot 13 contains action hashes; the access key is a separate field.
    const rawKey = entry.audioData[24];
    const info = await requestTrackInfo(entry.trackId, typeof rawKey === 'string' && rawKey ? rawKey : undefined);
    if (info?.url) {
      entry.title = info.title || entry.title;
      entry.performer = info.performer || entry.performer;
      entry.coverUrl = tupleArtwork(info.audioData ?? []) || info.coverUrl || entry.coverUrl;
      entry.audioData = info.audioData ?? entry.audioData;
      entry.duration = info.duration ?? entry.duration;
      entry.cachedUrl = info.url;
    }
  }
  if (signal?.aborted) throw new DOMException(t('music.cancelled'), 'AbortError');
  entry.title = decodeHtmlEntities(entry.title);
  entry.performer = decodeHtmlEntities(entry.performer);

  let url = entry.cachedUrl ?? '';
  if (!url) {
    url = await requestUrl(entry);
    if (url) entry.cachedUrl = url;
  }
  if (!url) throw new Error(t('music.link_unavailable'));

  const filename = buildFilename(entry.performer, entry.title, cfg.filenameFormat);

  // Сохраняем исходное аудио (или ремукс HLS), не добавляя метаданные.
  if (cfg.format === 'original') {
    const original = await fetchOriginal(url, onProgress, signal);
    return { filename, ...original };
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
