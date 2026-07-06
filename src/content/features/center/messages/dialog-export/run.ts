/** Оркестрация экспорта: история → (расшифровка) → (картинки) → файл. */

import { downloadBlob, downloadText } from '@/shared/utils/download.js';
import {
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError,
} from '@/content/ui/download-center/index.js';
import { sanitizeFilename } from '../../_shared/index.js';
import { detectChatTitle, detectPeerId } from './peer.js';
import { fetchAllHistory } from './history.js';
import { decryptAllInPlace } from './decrypt.js';
import { embedAllImages, buildZipArchive } from './images.js';
import { buildHtml, buildJson, buildTxt } from './render.js';
import type { ExportFormat } from './types.js';
import { t } from '@/content/i18n/index.js';

export async function runExport(format: ExportFormat, decrypt: boolean): Promise<void> {
  const peerId = detectPeerId();
  if (peerId === null) {
    alert(t('messages.export.no_peer'));
    return;
  }
  const title = detectChatTitle();

  // Экспорт живёт в общем центре загрузок (как видео/аудио/фото): прогресс по
  // фазам + крестик отмены прямо в задаче.
  const jobId = `export:${peerId}:${Date.now()}`;
  let cancelled = false;
  downloadCenterJobStart(jobId, t('messages.export.job', { title }), () => { cancelled = true; });
  const phase = (label: string, loaded = 0, total = 0): void =>
    downloadCenterJobUpdate(jobId, label, loaded, total);

  try {
    phase(t('messages.export.loading'));
    const { messages, names } = await fetchAllHistory(
      peerId,
      (loaded, total) => phase(t('messages.export.loading'), loaded, total),
      () => cancelled,
    );

    if (decrypt) {
      const stored = await chrome.storage.local.get(['message_crypto_key']);
      const key = (stored['message_crypto_key'] as string | undefined) ?? '';
      if (key) {
        phase(t('messages.export.decrypting'));
        await decryptAllInPlace(messages, key);
      }
    }

    if (format === 'html-embed') {
      await embedAllImages(
        messages,
        (done, total) => phase(t('messages.export.embedding'), done, total),
        () => cancelled,
      );
      if (cancelled) { downloadCenterJobError(jobId, t('messages.export.cancelled')); return; }
    }

    if (format === 'html-zip') {
      const blob = await buildZipArchive(
        title,
        messages,
        names,
        (done, total) => phase(t('messages.export.downloading'), done, total),
        () => cancelled,
      );
      if (cancelled) { downloadCenterJobError(jobId, t('messages.export.cancelled')); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `${sanitizeFilename(title)}_${stamp}.zip`);
      downloadCenterJobDone(jobId, t('messages.export.archive_done'));
      return;
    }

    let content: string;
    let mime: string;
    let ext: string;
    if (format === 'json')                                     { content = buildJson(title, peerId, messages, names); mime = 'application/json'; ext = 'json'; }
    else if (format === 'html' || format === 'html-embed')     { content = buildHtml(title, messages, names);          mime = 'text/html';        ext = 'html'; }
    else                                                       { content = buildTxt(title, messages, names);           mime = 'text/plain';       ext = 'txt';  }

    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(content, `${sanitizeFilename(title)}_${stamp}.${ext}`, mime);
    downloadCenterJobDone(jobId, t('messages.export.file_done', { ext }));
  } catch (err) {
    if (cancelled) {
      downloadCenterJobError(jobId, t('messages.export.cancelled'));
    } else {
      console.error('[VKify] Export failed:', err);
      downloadCenterJobError(jobId, t('messages.export.error'));
    }
  }
}
