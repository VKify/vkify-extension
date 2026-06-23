/**
 * Определение ID и названия текущего диалога из URL/DOM.
 *
 * Migrated to new DOM layer: селекторы шапки чата — из SELECTORS.messages.
 */

import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { CHAT_PEER_OFFSET } from './constants.js';

export function detectPeerId(): number | null {
  // 1. URL query (старый IM)
  const sp = new URLSearchParams(location.search);
  const sel = sp.get('sel') ?? sp.get('peer');
  if (sel) {
    if (/^c\d+$/.test(sel)) return CHAT_PEER_OFFSET + Number(sel.slice(1));
    const n = Number(sel);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  // 2. URL path (новый messenger)
  const m = location.pathname.match(/\/im(?:\/convo)?\/(-?\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  // 3. DOM: ссылка-аватар в шапке
  const link = safeQuerySelector<HTMLAnchorElement>(SELECTORS.messages.convoHeaderInfo);
  const href = link?.getAttribute('href') ?? '';
  let r: RegExpMatchArray | null;
  if ((r = href.match(/^\/id(\d+)/)))              return Number(r[1]);
  if ((r = href.match(/^\/(?:club|public)(\d+)/))) return -Number(r[1]);
  if ((r = href.match(/^\/im\?sel=c(\d+)/)))       return CHAT_PEER_OFFSET + Number(r[1]);
  if ((r = href.match(/^\/im\/convo\/(-?\d+)/)))   return Number(r[1]);
  return null;
}

export function detectChatTitle(): string {
  const el = safeQuerySelector<HTMLElement>(SELECTORS.messages.convoTitle);
  return el?.getAttribute('title')?.trim() || el?.textContent?.trim() || 'dialog';
}
