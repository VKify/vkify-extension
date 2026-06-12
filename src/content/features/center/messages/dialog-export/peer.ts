/** Определение ID и названия текущего диалога из URL/DOM. */

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
  const link = document.querySelector<HTMLAnchorElement>('.ConvoHeader__info');
  const href = link?.getAttribute('href') ?? '';
  let r: RegExpMatchArray | null;
  if ((r = href.match(/^\/id(\d+)/)))              return Number(r[1]);
  if ((r = href.match(/^\/(?:club|public)(\d+)/))) return -Number(r[1]);
  if ((r = href.match(/^\/im\?sel=c(\d+)/)))       return CHAT_PEER_OFFSET + Number(r[1]);
  if ((r = href.match(/^\/im\/convo\/(-?\d+)/)))   return Number(r[1]);
  return null;
}

export function detectChatTitle(): string {
  const el =
    document.querySelector<HTMLElement>('.ConvoHeader .ConvoTitle__author') ||
    document.querySelector<HTMLElement>('.ConvoHeader .PeerTitle__title');
  return el?.getAttribute('title')?.trim() || el?.textContent?.trim() || 'dialog';
}
