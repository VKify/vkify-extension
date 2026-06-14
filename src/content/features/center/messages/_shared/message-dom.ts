/**
 * Общие DOM-хелперы для фич, навешивающих кнопки на сообщения ВК-мессенджера.
 * Разметка варьируется (bubble / no-bubble / разные версии движка), поэтому у
 * каждого узла — список селекторов-кандидатов от точного к более общему.
 */

const TEXT_SELECTORS = [
  '.ConvoMessageWithoutBubble__text',
  '.ConvoMessageBubble__text',
  '[class*="MessageBubble__text"]',
  '[class*="Message__text"]',
];

const INFO_ROW_SELECTORS = [
  '.ConvoMessageInfoWithoutBubbles',
  '[class*="ConvoMessageBubble__info"]',
  '[class*="MessageInfo"]',
  '[class*="Message__info"]',
];

const CONTENT_SELECTORS = [
  '.ConvoMessageWithoutBubble__content',
  '[class*="MessageBubble__content"]',
];

function firstMatch(messageBlock: Element, selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    const el = messageBlock.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  return null;
}

/** Узел с текстом сообщения (null — системное сообщение без текста). */
export function findTextEl(messageBlock: Element): HTMLElement | null {
  return firstMatch(messageBlock, TEXT_SELECTORS);
}

/** Инфо-строка (дата/статус) — туда подставляем кнопку. */
export function findInfoRow(messageBlock: Element): HTMLElement | null {
  return firstMatch(messageBlock, INFO_ROW_SELECTORS);
}

/** Контейнер контента — фолбэк-якорь, если инфо-строка не нашлась. */
export function findContentEl(messageBlock: Element): HTMLElement | null {
  return firstMatch(messageBlock, CONTENT_SELECTORS);
}

/**
 * Чистый текст сообщения без префиксных меток расшифровки (☕ COFFEE: / 🔐 E2E:),
 * которые добавляет фича message-crypto (они помечены title-атрибутом).
 */
export function extractMessageText(messageBlock: Element): string {
  const textEl = findTextEl(messageBlock);
  if (!textEl) return '';
  const clone = textEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[title*="нажмите, чтобы увидеть оригинал"]').forEach(el => el.remove());
  return clone.innerText.trim();
}

/** Имя автора из шапки сообщения (если есть). */
export function extractAuthor(messageBlock: Element): string {
  return messageBlock.querySelector<HTMLElement>(
    '.ConvoMessageHeader__authorLink .PeerTitle__title, [class*="MessageHeader"] [class*="PeerTitle__title"], [class*="MessageHeader"] [class*="__author"]',
  )?.textContent?.trim() ?? '';
}

/** Время отправки из инфо-строки сообщения. */
export function extractTime(messageBlock: Element): string {
  return messageBlock.querySelector<HTMLElement>(
    '.ConvoMessageInfoWithoutBubbles__date, [class*="__date"]',
  )?.textContent?.trim() ?? '';
}
