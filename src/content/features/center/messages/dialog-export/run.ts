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

export async function runExport(format: ExportFormat, decrypt: boolean): Promise<void> {
  const peerId = detectPeerId();
  if (peerId === null) {
    alert('VKify: не удалось определить ID диалога');
    return;
  }
  const title = detectChatTitle();

  // Экспорт живёт в общем центре загрузок (как видео/аудио/фото): прогресс по
  // фазам + крестик отмены прямо в задаче.
  const jobId = `export:${peerId}:${Date.now()}`;
  let cancelled = false;
  downloadCenterJobStart(jobId, `Экспорт: ${title}`, () => { cancelled = true; });
  const phase = (label: string, loaded = 0, total = 0): void =>
    downloadCenterJobUpdate(jobId, label, loaded, total);

  try {
    phase('Загрузка сообщений');
    const { messages, names } = await fetchAllHistory(
      peerId,
      (loaded, total) => phase('Загрузка сообщений', loaded, total),
      () => cancelled,
    );

    if (decrypt) {
      const stored = await chrome.storage.local.get(['message_crypto_key']);
      const key = (stored['message_crypto_key'] as string | undefined) ?? '';
      if (key) {
        phase('Расшифровываю сообщения');
        await decryptAllInPlace(messages, key);
      }
    }

    if (format === 'html-embed') {
      await embedAllImages(
        messages,
        (done, total) => phase('Встраиваю фото в файл', done, total),
        () => cancelled,
      );
      if (cancelled) { downloadCenterJobError(jobId, 'Отменено'); return; }
    }

    if (format === 'html-zip') {
      const blob = await buildZipArchive(
        title,
        messages,
        names,
        (done, total) => phase('Скачиваю фото для архива', done, total),
        () => cancelled,
      );
      if (cancelled) { downloadCenterJobError(jobId, 'Отменено'); return; }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `${sanitizeFilename(title)}_${stamp}.zip`);
      downloadCenterJobDone(jobId, 'Архив сохранён');
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
    downloadCenterJobDone(jobId, `Файл .${ext} сохранён`);
  } catch (err) {
    if (cancelled) {
      downloadCenterJobError(jobId, 'Отменено');
    } else {
      console.error('[VKify] Export failed:', err);
      downloadCenterJobError(jobId, 'Ошибка экспорта');
    }
  }
}
