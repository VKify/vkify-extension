/** Оркестрация экспорта: история → (расшифровка) → (картинки) → файл. */

import { downloadBlob, downloadText } from '@/shared/utils/download.js';
import {
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError,
} from '@/content/ui/download-center/index.js';
import { sanitizeFilename } from '../../_shared/index.js';
import { detectChatTitle, detectConversationContext } from './peer.js';
import { fetchAllHistory, fetchConversationMeta, filterSelectedMessages } from './history.js';
import { decryptAllInPlace } from './decrypt.js';
import { embedChatImages, buildZipArchive } from './images.js';
import { buildHtml, buildJson, buildTxt } from './render.js';
import type { ExportFormat } from './types.js';
import { t } from '@/content/i18n/index.js';
import { buildPdfDocument } from './pdf-template.js';
import { savePdf } from './pdf.js';

export async function runExport(
  format: ExportFormat,
  decrypt: boolean,
  selectedIds?: ReadonlySet<number>,
): Promise<void> {
  const context = detectConversationContext();
  if (context === null) {
    alert(t('messages.export.no_peer'));
    return;
  }
  const { peerId } = context;
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
    const history = await fetchAllHistory(
      context,
      (loaded, total) => phase(t('messages.export.loading'), loaded, total),
      () => cancelled,
    );
    const { names } = history;
    const messages = selectedIds
      ? filterSelectedMessages(history.messages, selectedIds)
      : history.messages;
    const needsChatMeta = format === 'html' || format === 'html-embed'
      || format === 'html-zip' || format === 'pdf';
    const meta = needsChatMeta
      ? await fetchConversationMeta(context)
      : { outReadCmid: null };

    if (format === 'pdf' && messages.length === 0) {
      throw new Error(t('messages.export.selection.not_found'));
    }

    if (decrypt) {
      const stored = await chrome.storage.local.get(['message_crypto_key']);
      const key = (stored['message_crypto_key'] as string | undefined) ?? '';
      if (key) {
        phase(t('messages.export.decrypting'));
        await decryptAllInPlace(messages, key);
      }
    }

    if (format === 'html-embed') {
      await embedChatImages(
        messages,
        names,
        (done, total) => phase(t('messages.export.embedding'), done, total),
        () => cancelled,
      );
      if (cancelled) { downloadCenterJobError(jobId, t('messages.export.cancelled')); return; }
    }

    if (format === 'pdf') {
      await embedChatImages(
        messages,
        names,
        (done, total) => phase(t('messages.export.embedding'), done, total),
        () => cancelled,
      );
      if (cancelled) { downloadCenterJobError(jobId, t('messages.export.cancelled')); return; }

      phase(t('messages.export.pdf.rendering'));
      const root = buildPdfDocument(title, messages, names, meta);
      // On-demand renderer сам клонирует и пагинирует узел во временном
      // невидимом контейнере; исходник не добавляем в DOM, чтобы PDF-вёрстка
      // ни на кадр не мелькнула в VK.
      const stamp = new Date().toISOString().slice(0, 10);
      await savePdf(root, `${sanitizeFilename(title)}_${stamp}.pdf`);
      downloadCenterJobDone(jobId, t('messages.export.file_done', { ext: 'pdf' }));
      return;
    }

    if (format === 'html-zip') {
      const blob = await buildZipArchive(
        title,
        messages,
        names,
        meta,
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
    if (format === 'json')                                     { content = buildJson(title, peerId, messages, names, context.groupId); mime = 'application/json'; ext = 'json'; }
    else if (format === 'html' || format === 'html-embed')     { content = buildHtml(title, messages, names, meta);    mime = 'text/html';        ext = 'html'; }
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
