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
