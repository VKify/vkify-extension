/**
 * Экранирование строки для безопасной вставки в HTML.
 *
 * Покрывает и текстовые узлы, и значения атрибутов (`"` и `'` тоже),
 * поэтому результат безопасен в любом из этих контекстов.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Возвращает URL, безопасный для подстановки в `href`/`src`. Пропускает
 * http(s)/mailto/tel, относительные/якорные ссылки и `data:image/*` (для
 * встроенных картинок). Всё остальное — прежде всего `javascript:`,
 * `vbscript:`, `file:` и `data:text/html` — заменяет на `#`.
 *
 * Нужно там, где ссылка приходит из недоверенных данных (вложения сообщений)
 * и попадает в HTML, который пользователь потом открывает локально (file://),
 * где клик по `javascript:`-ссылке исполнился бы как XSS. `escapeHtml` тут не
 * помогает — он не трогает схему URL.
 */
export function safeUrl(raw: string | null | undefined): string {
  if (!raw) return '#';
  const trimmed = raw.trim();
  // Браузер игнорирует пробелы/управляющие символы внутри схемы
  // (`java\tscript:`) — вырезаем диапазон \x00–\x20 перед проверкой.
  // eslint-disable-next-line no-control-regex
  const probe = trimmed.replace(/[\x00-\x20]/g, '');
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) return trimmed; // относительная или якорная ссылка
  const proto = scheme[1].toLowerCase();
  if (proto === 'http' || proto === 'https' || proto === 'mailto' || proto === 'tel') {
    return trimmed;
  }
  // data: — только картинки, не text/html.
  if (proto === 'data' && /^data:image\//i.test(probe)) return trimmed;
  return '#';
}
