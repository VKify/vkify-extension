/**
 * Определение источника сообщения: cmid, peer_id и название чата.
 *
 * Migrated to DOMObserver + selectors: VK-селекторы вынесены в SELECTORS.messages.
 */

import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { CHAT_PEER_OFFSET } from './constants.js';
export { extractCmid } from '../_shared/message-dom.js';

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
