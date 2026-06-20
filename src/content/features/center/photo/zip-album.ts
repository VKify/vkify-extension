/** Скачивание всего альбома фото в ZIP (с разбиением больших на части). */

import { buildZip, type ZipEntry } from '../../../../shared/utils/zip.js';
import { downloadBlob } from '../../../../shared/utils/download.js';
import { fetchAlbumPhotos, fetchPhotoBytes, getBestPhotoUrl, sleep } from './api.js';

const ZIP_CHUNK_SIZE = 500; // фото в одном архиве — защита от OOM

/**
 * Скачивает альбом как ZIP. При размере > ZIP_CHUNK_SIZE — несколько частей
 * `…-part-NN.zip`, чтобы не упереться в память. По сигналу отмены прекращает
 * сбор и упаковывает уже скачанные фото — работа не теряется.
 */
export async function downloadAlbumAll(
  ownerId: number,
  albumId: string,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ ok: number; total: number; failed: number; cancelled: boolean }> {
  const items = await fetchAlbumPhotos(ownerId, albumId);
  if (items.length === 0) return { ok: 0, total: 0, failed: 0, cancelled: false };

  const idxPad      = String(items.length).length;
  const numChunks   = Math.ceil(items.length / ZIP_CHUNK_SIZE);
  const partPad     = String(numChunks).length;
  const baseName    = `vkify-album-${ownerId}_${albumId}`;
  let ok        = 0;
  let failed    = 0;
  let cancelled = false;

  for (let c = 0; c < numChunks && !cancelled; c++) {
    const slice   = items.slice(c * ZIP_CHUNK_SIZE, (c + 1) * ZIP_CHUNK_SIZE);
    const entries: ZipEntry[] = [];

    for (let j = 0; j < slice.length; j++) {
      if (signal?.aborted) { cancelled = true; break; }
      const globalIdx = c * ZIP_CHUNK_SIZE + j;
      const item      = slice[j];
      const url       = getBestPhotoUrl(item.sizes);
      if (!url) {
        failed++;
        onProgress(globalIdx + 1, items.length);
        continue;
      }
      const bytes = await fetchPhotoBytes(url);
      if (!bytes) {
        failed++;
        onProgress(globalIdx + 1, items.length);
        continue;
      }
      const idx = String(globalIdx + 1).padStart(idxPad, '0');
      entries.push({ name: `photo_${idx}_${item.id}.jpg`, data: bytes });
      ok++;
      onProgress(globalIdx + 1, items.length);
      await sleep(40);
    }

    // Упаковываем даже частичный результат (в т.ч. при отмене).
    if (entries.length === 0) continue;

    const filename = numChunks === 1
      ? `${baseName}.zip`
      : `${baseName}-part-${String(c + 1).padStart(partPad, '0')}.zip`;
    downloadBlob(buildZip(entries), filename);

    if (!cancelled && c < numChunks - 1) await sleep(400);
  }
  return { ok, total: items.length, failed, cancelled };
}
