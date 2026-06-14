/** Запрос на скачивание файла через background (chrome.downloads). */

import {
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError,
} from '../../../ui/download-center/index.js';

/** Отправляет запрос на скачивание в background (chrome.downloads) и показывает
 *  его в едином центре загрузок (видео/клипы/сторис/фото идут через эту функцию). */
export function requestDownload(url: string, filename: string): void {
  const id = `file:${filename}#${Date.now()}`;
  downloadCenterJobStart(id, filename);
  downloadCenterJobUpdate(id, 'Скачивание…');
  void Promise.resolve(chrome.runtime.sendMessage({ type: 'DOWNLOAD_VIDEO', url, filename }))
    .then((resp: unknown) => {
      const r = resp as { success?: boolean; error?: string } | undefined;
      if (r && r.success === false) downloadCenterJobError(id, r.error || 'Ошибка');
      else downloadCenterJobDone(id, 'В загрузках браузера');
    })
    .catch(() => downloadCenterJobError(id, 'Ошибка'));
}
