/**
 * Детектор активного диалога — peerId/имя резолвятся из любого источника:
 *   1. URL query — старый IM (vk.com/im?sel=…).
 *   2. URL path — Messenger Engine (vk.com/im/convo/<peerId>).
 *   3. DOM — заголовок ConvoHeader: avatar-ссылка `/id<N>` / `/club<N>` и
 *      текст ConvoTitle__author / PeerTitle__title.
 *
 * DOM-фолбэк критичен: на новом VK URL во многих случаях остаётся `/im`
 * (без peerId), и единственный надёжный источник — DOM шапки чата.
 */

import { vkApi } from '../../../../api/vk-api-client.js';
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
  const headerLink =
    document.querySelector<HTMLAnchorElement>('.ConvoHeader__info') ||
    document.querySelector<HTMLAnchorElement>('a[class*="ConvoHeader__info"]');
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

  const headerScope = document.querySelector<HTMLElement>('.ConvoHeader');
  const titleEl =
    headerScope?.querySelector<HTMLElement>('.ConvoTitle__author') ||
    headerScope?.querySelector<HTMLElement>('.PeerTitle__title') ||
    document.querySelector<HTMLElement>('[data-testid="im_dialog_header_title"]') ||
    document.querySelector<HTMLElement>('[class*="ChatHeaderTitle__title"]') ||
    document.querySelector<HTMLElement>('[class*="DialogHeader__title"]');
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
