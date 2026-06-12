/** Оркестрация экспорта: история → (расшифровка) → (картинки) → файл. */

import { downloadBlob, downloadText } from '../../../../../shared/utils/download.js';
import { sanitizeFilename } from '../../../media/_shared.js';
import { detectChatTitle, detectPeerId } from './peer.js';
import { fetchAllHistory } from './history.js';
import { decryptAllInPlace } from './decrypt.js';
import { embedAllImages, buildZipArchive } from './images.js';
import { buildHtml, buildJson, buildTxt } from './render.js';
import { showProgressOverlay } from './overlay.js';
import type { ExportFormat } from './types.js';

export async function runExport(format: ExportFormat, decrypt: boolean): Promise<void> {
  const peerId = detectPeerId();
  if (peerId === null) {
    alert('VKify: не удалось определить ID диалога');
    return;
  }
  const title = detectChatTitle();

  let cancelled = false;
  const overlay = showProgressOverlay(title);
  overlay.onCancel(() => { cancelled = true; });

  try {
    overlay.setPhase('Загрузка сообщений');
    const { messages, names } = await fetchAllHistory(
      peerId,
      (loaded, total) => overlay.setProgress(loaded, total),
      () => cancelled,
    );

    if (decrypt) {
      const stored = await chrome.storage.local.get(['message_crypto_key']);
      const key = (stored['message_crypto_key'] as string | undefined) ?? '';
      if (key) {
        overlay.setPhase('Расшифровываю сообщения');
        overlay.setProgress(0, 0);
        await decryptAllInPlace(messages, key);
      }
    }

    if (format === 'html-embed') {
      overlay.setPhase('Встраиваю фото в файл');
      overlay.setProgress(0, 0);
      await embedAllImages(
        messages,
        (done, total) => overlay.setProgress(done, total),
        () => cancelled,
      );
    }

    if (format === 'html-zip') {
      overlay.setPhase('Скачиваю фото для архива');
      overlay.setProgress(0, 0);
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = await buildZipArchive(
        title,
        messages,
        names,
        (done, total) => overlay.setProgress(done, total),
        () => cancelled,
      );
      downloadBlob(blob, `${sanitizeFilename(title)}_${stamp}.zip`);
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
  } catch (err) {
    if (!cancelled) {
      console.error('[VKify] Export failed:', err);
      alert('VKify: не удалось экспортировать диалог. Проверьте, что вы авторизованы в ВК и токен расширения активен.');
    }
  } finally {
    overlay.close();
  }
}
