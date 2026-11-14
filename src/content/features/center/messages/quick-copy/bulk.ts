/**
 * Копирование диапазона сообщений по Shift+клику. Первый Shift+клик отмечает
 * «якорь», второй — копирует все сообщения между ними (в порядке документа)
 * одной простынёй «[время автор] текст». Esc отменяет выбор (см. index.ts).
 */

import { copyContent } from './content.js';
import { copyToClipboard, showToast } from './clipboard.js';
import { queryAll } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { BTN_CLASS } from './constants.js';
import { t } from '@/content/i18n/index.js';

let bulkAnchor: { block: Element; btn: HTMLButtonElement } | null = null;

export function bulkAnchorActive(): boolean {
  return bulkAnchor !== null;
}

export function clearAnchor(): void {
  if (!bulkAnchor) return;
  bulkAnchor.btn.classList.remove(`${BTN_CLASS}--anchor`);
  bulkAnchor.btn.dataset.tooltip = t('messages.quick_copy.copy');
  bulkAnchor = null;
}

/** Все .ConvoHistory__messageBlock в порядке документа между двумя (включительно). */
// Migrated to new DOM layer: список сообщений — через SELECTORS.messages.block.
function collectRange(a: Element, b: Element): Element[] {
  const all = queryAll<Element>(SELECTORS.messages.block);
  let i = all.indexOf(a);
  let j = all.indexOf(b);
  if (i < 0 || j < 0) return [];
  if (i > j) [i, j] = [j, i];
  return all.slice(i, j + 1);
}

/** Обрабатывает Shift+клик: ставит/снимает якорь либо копирует диапазон. */
export async function handleShiftClick(messageBlock: Element, btn: HTMLButtonElement): Promise<void> {
  if (!bulkAnchor) {
    bulkAnchor = { block: messageBlock, btn };
    btn.classList.add(`${BTN_CLASS}--anchor`);
    btn.dataset.tooltip = t('messages.quick_copy.anchor');
    return;
  }

  if (bulkAnchor.block === messageBlock) {
    // Повторный Shift+клик на том же — отменяем выбор.
    clearAnchor();
    return;
  }

  const range = collectRange(bulkAnchor.block, messageBlock);
  clearAnchor();
  const lines = await copyContent(range, true);
  const ok = await copyToClipboard(lines.join('\n'));
  showToast(ok ? t('messages.quick_copy.copied_n', { count: lines.length }) : t('messages.quick_copy.failed'));
}
