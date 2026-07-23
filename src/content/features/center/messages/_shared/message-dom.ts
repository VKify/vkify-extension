/**
 * Общие DOM-хелперы для фич, навешивающих кнопки на сообщения ВК-мессенджера.
 * Разметка варьируется (bubble / no-bubble / разные версии движка), поэтому у
 * каждого узла — список селекторов-кандидатов от точного к более общему.
 */

import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';

/** Узел с текстом сообщения (null — системное сообщение без текста). */
export function findTextEl(messageBlock: Element): HTMLElement | null {
  return safeQuerySelector<HTMLElement>(SELECTORS.messages.text, messageBlock);
}

/** Инфо-строка (дата/статус) — туда подставляем кнопку. */
export function findInfoRow(messageBlock: Element): HTMLElement | null {
  return safeQuerySelector<HTMLElement>(SELECTORS.messages.infoRow, messageBlock);
}

/** Контейнер контента — фолбэк-якорь, если инфо-строка не нашлась. */
export function findContentEl(messageBlock: Element): HTMLElement | null {
  return safeQuerySelector<HTMLElement>(SELECTORS.messages.content, messageBlock);
}

/**
 * Чистый текст сообщения без префиксных меток расшифровки (☕ COFFEE: / 🔐 E2E:),
 * которые добавляет фича message-crypto (они помечены title-атрибутом).
 */
export function extractMessageText(messageBlock: Element): string {
  const textEl = findTextEl(messageBlock);
  if (!textEl) return '';
  const clone = textEl.cloneNode(true) as HTMLElement;
  // Бейдж расшифровки помечен стабильным data-атрибутом (title локализуется).
  // Легаси-матч по RU-подстроке title оставлен для уже отрендеренных бейджей.
  clone.querySelectorAll('[data-vkify-crypto-badge], [title*="нажмите, чтобы увидеть оригинал"]').forEach(el => el.remove());
  return clone.innerText.trim();
}

/** Имя автора из шапки сообщения (если есть). */
export function extractAuthor(messageBlock: Element): string {
  return safeQuerySelector<HTMLElement>(SELECTORS.messages.author, messageBlock)
    ?.textContent?.trim() ?? '';
}

/** Время отправки из инфо-строки сообщения. */
export function extractTime(messageBlock: Element): string {
  return safeQuerySelector<HTMLElement>(SELECTORS.messages.date, messageBlock)
    ?.textContent?.trim() ?? '';
}

/**
 * conversation_message_id из DOM сообщения. VirtualScroll хранит его в
 * data-itemkey; остальные атрибуты нужны для альтернативной разметки /gim и
 * переходных версий Messenger Engine.
 */
export function extractCmid(messageBlock: Element): number | null {
  const itemKeyHost =
    messageBlock.closest(SELECTORS.messages.itemKey) ??
    messageBlock.querySelector(SELECTORS.messages.itemKey);
  const itemKey = itemKeyHost?.getAttribute('data-itemkey');
  if (itemKey && /^\d+$/.test(itemKey)) return Number(itemKey);

  const candidates: Element[] = [
    messageBlock,
    ...Array.from(messageBlock.querySelectorAll(SELECTORS.messages.cmidAttrs)),
  ];
  for (const el of candidates) {
    for (const attr of ['data-cmid', 'data-msgid', 'data-message-id']) {
      const value = el.getAttribute(attr);
      if (value && /^\d+$/.test(value)) return Number(value);
    }
  }
  return null;
}
