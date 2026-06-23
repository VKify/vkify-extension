/**
 * Детектор активного диалога — peerId/имя резолвятся из любого источника:
 *   1. URL query — старый IM (vk.com/im?sel=…).
 *   2. URL path — Messenger Engine (vk.com/im/convo/<peerId>).
 *   3. DOM — заголовок ConvoHeader: avatar-ссылка `/id<N>` / `/club<N>` и
 *      текст ConvoTitle__author / PeerTitle__title.
 *
 * DOM-фолбэк критичен: на новом VK URL во многих случаях остаётся `/im`
 * (без peerId), и единственный надёжный источник — DOM шапки чата.
 *
 * Migrated to DOMObserver + selectors: селекторы шапки чата вынесены в
 * SELECTORS.messages (convoHeader / convoHeaderInfo / convoTitleInner / …).
 */

import { vkApi } from '@/content/api/vk-api-client.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { CHAT_PEER_OFFSET } from './constants.js';

export interface PeerInfo {
  peerId: number | null;
  firstName: string;
  lastName: string;
  title: string;
}

const vanityToPeerCache = new Map<string, number | null>();

export async function resolveVanityToPeerId(screenName: string): Promise<number | null> {
  const cached = vanityToPeerCache.get(screenName);
  if (cached !== undefined) return cached;
  try {
    const r = await vkApi.call('utils.resolveScreenName', { screen_name: screenName }) as
      { type?: string; object_id?: number } | null;
    let peerId: number | null = null;
    if (r && typeof r.object_id === 'number') {
      if (r.type === 'user') peerId = r.object_id;
      else if (r.type === 'group' || r.type === 'page' || r.type === 'application') peerId = -r.object_id;
    }
    vanityToPeerCache.set(screenName, peerId);
    return peerId;
  } catch {
    vanityToPeerCache.set(screenName, null);
    return null;
  }
}

export async function detectPeer(): Promise<PeerInfo> {
  let peerId: number | null = null;

  // 1. ?sel= / ?peer= в query
  const sp = new URLSearchParams(location.search);
  const sel = sp.get('sel') ?? sp.get('peer');
  if (sel) {
    if (/^c\d+$/.test(sel)) peerId = CHAT_PEER_OFFSET + Number(sel.slice(1));
    else {
      const n = Number(sel);
      if (Number.isFinite(n) && n !== 0) peerId = n;
    }
  }

  // 2. /im/convo/<id> или /im/<id> в pathname
  if (peerId === null) {
    const m = location.pathname.match(/\/im(?:\/convo)?\/(-?\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n !== 0) peerId = n;
    }
  }

  // 3a. DOM: ConvoHeader → avatar link (`href="/id100"` и т.п.)
  const headerLink = safeQuerySelector<HTMLAnchorElement>(SELECTORS.messages.convoHeaderInfo);
  if (peerId === null && headerLink) {
    const href = headerLink.getAttribute('href') ?? '';
    let m: RegExpMatchArray | null;
    if      ((m = href.match(/^\/id(\d+)/)))         peerId = Number(m[1]);
    else if ((m = href.match(/^\/club(\d+)/)))       peerId = -Number(m[1]);
    else if ((m = href.match(/^\/public(\d+)/)))     peerId = -Number(m[1]);
    else if ((m = href.match(/^\/im\?sel=c(\d+)/)))  peerId = CHAT_PEER_OFFSET + Number(m[1]);
    else if ((m = href.match(/^\/im\/convo\/(-?\d+)/))) peerId = Number(m[1]);
  }

  if (peerId === null && headerLink) {
    const href = headerLink.getAttribute('href') ?? '';
    const m = href.match(/^\/([A-Za-z0-9_.]+)\/?$/);
    if (m) {
      peerId = await resolveVanityToPeerId(m[1]);
    }
  }

  const headerScope = safeQuerySelector<HTMLElement>(SELECTORS.messages.convoHeader);
  const titleEl =
    safeQuerySelector<HTMLElement>(SELECTORS.messages.convoTitleInner, headerScope) ||
    safeQuerySelector<HTMLElement>(SELECTORS.messages.dialogHeaderTitle);
  // `title="…"` атрибут — то же, что и textContent, но устойчив к truncate-у;
  // предпочитаем его, если он есть.
  const title = titleEl?.getAttribute('title')?.trim()
             || titleEl?.textContent?.trim()
             || '';

  // Раскладка title → first/last: для имён/фамилий ЛС работает «как ожидается»;
  // для бесед first_name = весь title (групповое название), last_name пустой —
  // это разумный fallback для тех, кто использует `%first_name%` в групповом чате.
  const parts = title.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? '';
  const lastName  = parts.slice(1).join(' ');

  return { peerId, firstName, lastName, title };
}
