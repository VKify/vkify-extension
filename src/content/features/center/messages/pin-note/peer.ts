/**
 * Определение источника сообщения: cmid, peer_id и название чата.
 *
 * Migrated to DOMObserver + selectors: VK-селекторы вынесены в SELECTORS.messages.
 */

import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { CHAT_PEER_OFFSET } from './constants.js';

/**
 * conversation_message_id сообщения — для прямой ссылки из попапа
 * (vk.ru/im/convo/<peer>?cmid=…). Messenger Engine хранит cmid в атрибуте
 * data-itemkey обёртки VirtualScrollItem (она может быть и снаружи блока, и
 * внутри — смотрим через closest и querySelector). Фолбэки по data-атрибутам
 * на случай других версий разметки. Не нашли — заметка сохранится без ссылки.
 */
export function extractCmid(messageBlock: Element): number | null {
  const itemKeyHost =
    messageBlock.closest(SELECTORS.messages.itemKey) ??
    messageBlock.querySelector(SELECTORS.messages.itemKey);
  const itemKey = itemKeyHost?.getAttribute('data-itemkey');
  if (itemKey && /^\d+$/.test(itemKey)) return Number(itemKey);

  const candidates: Element[] = [
    messageBlock,
    // cmidAttrs — union-строка (querySelectorAll), не queryAll: нужны узлы из всех атрибутов.
    ...Array.from(messageBlock.querySelectorAll(SELECTORS.messages.cmidAttrs)),
  ];
  for (const el of candidates) {
    for (const attr of ['data-cmid', 'data-msgid', 'data-message-id']) {
      const v = el.getAttribute(attr);
      if (v && /^\d+$/.test(v)) return Number(v);
    }
  }
  return null;
}

/** peer_id текущего открытого чата (нужен, чтобы в попапе показать «откуда»). */
export function detectPeerId(): number | null {
  const sp = new URLSearchParams(location.search);
  const sel = sp.get('sel') ?? sp.get('peer');
  if (sel) {
    if (/^c\d+$/.test(sel)) return CHAT_PEER_OFFSET + Number(sel.slice(1));
    const n = Number(sel);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  const m = location.pathname.match(/\/im(?:\/convo)?\/(-?\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return null;
}

export function detectPeerTitle(): string {
  const el = safeQuerySelector<HTMLElement>(SELECTORS.messages.convoTitle);
  return el?.getAttribute('title')?.trim() || el?.textContent?.trim() || '';
}
