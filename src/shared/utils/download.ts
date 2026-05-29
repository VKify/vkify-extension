/**
 * Скачивание файлов из браузера через временный `<a download>`.
 *
 * Почему не `chrome.downloads`: из content-script blob:-URL для него ненадёжен,
 * а popup не всегда имеет доступ к API. Якорный трюк работает в обоих контекстах.
 */

/** Триггерит скачивание готового Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Освобождаем object URL с запасом: некоторые браузеры начинают качать
  // асинхронно уже после click(), и ранний revoke оборвал бы большие файлы.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Триггерит скачивание текстового содержимого как файла (UTF-8). */
export function downloadText(content: string, filename: string, mime = 'text/plain'): void {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), filename);
}
