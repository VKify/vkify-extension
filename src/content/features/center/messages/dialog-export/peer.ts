/**
 * Определение ID и названия текущего диалога из URL/DOM.
 *
 * Migrated to new DOM layer: селекторы шапки чата — из SELECTORS.messages.
 */

import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { CHAT_PEER_OFFSET } from './constants.js';

export interface ConversationContext {
  peerId: number;
  /** ID сообщества для /gim; null для обычного /im. */
  groupId: number | null;
}

function parsePeerValue(value: string | null): number | null {
  if (!value) return null;
  if (/^c\d+$/.test(value)) return CHAT_PEER_OFFSET + Number(value.slice(1));
  const peerId = Number(value);
  return Number.isFinite(peerId) && peerId !== 0 ? peerId : null;
}

/**
 * Разбирает URL обоих мессенджеров VK:
 *   /im/convo/<peerId> и legacy /im?sel=...
 *   /gim<groupId>/convo/<peerId> (сообщения сообщества).
 */
export function parseConversationContext(url: URL): ConversationContext | null {
  // Query нужен для legacy /im. Если VK оставляет sel/peer при SPA-навигации,
  // он по-прежнему является самым точным источником активного peer.
  const sp = url.searchParams;
  const sel = sp.get('sel') ?? sp.get('peer');
  const queryPeerId = parsePeerValue(sel);

  const gimRoot = url.pathname.match(/^\/gim(\d+)(?:\/|$)/);
  if (gimRoot) {
    const groupId = Number(gimRoot[1]);
    const gimConversation = url.pathname.match(/^\/gim\d+(?:\/convo)?\/(-?\d+)(?:\/|$)/);
    const pathPeerId = parsePeerValue(gimConversation?.[1] ?? null);
    const peerId = queryPeerId ?? pathPeerId;
    if (Number.isFinite(groupId) && groupId > 0 && peerId !== null) {
      return { peerId, groupId };
    }
  }

  if (queryPeerId !== null) return { peerId: queryPeerId, groupId: null };

  const m = url.pathname.match(/^\/im(?:\/convo)?\/(-?\d+)(?:\/|$)/);
  if (m) {
    const peerId = parsePeerValue(m[1]);
    if (peerId !== null) return { peerId, groupId: null };
  }

  return null;
}

export function detectConversationContext(): ConversationContext | null {
  const fromUrl = parseConversationContext(new URL(location.href));
  if (fromUrl) return fromUrl;

  // DOM-фолбэк: ссылка-аватар/заголовок в шапке. Помимо профилей ссылка
  // может вести прямо в /im или /gim conversation.
  const link = safeQuerySelector<HTMLAnchorElement>(SELECTORS.messages.convoHeaderInfo);
  const href = link?.getAttribute('href') ?? '';
  if (href) {
    const fromLink = parseConversationContext(new URL(href, location.origin));
    if (fromLink) return fromLink;
  }

  let r: RegExpMatchArray | null;
  if ((r = href.match(/^\/id(\d+)/)))              return { peerId: Number(r[1]), groupId: null };
  if ((r = href.match(/^\/(?:club|public)(\d+)/))) return { peerId: -Number(r[1]), groupId: null };
  return null;
}

/** Обратная совместимость для потребителей, которым нужен только peer_id. */
export function detectPeerId(): number | null {
  return detectConversationContext()?.peerId ?? null;
}

export function detectChatTitle(): string {
  const header = safeQuerySelector<HTMLElement>(SELECTORS.messages.convoHeader);
  const el = safeQuerySelector<HTMLElement>(SELECTORS.messages.convoTitleInner, header)
    ?? safeQuerySelector<HTMLElement>(SELECTORS.messages.convoTitle)
    ?? safeQuerySelector<HTMLElement>(SELECTORS.messages.dialogHeaderTitle);
  return el?.getAttribute('title')?.trim() || el?.textContent?.trim() || 'dialog';
}
