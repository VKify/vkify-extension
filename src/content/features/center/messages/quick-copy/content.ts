import { getService, SERVICES } from '@/content/core/services/index.js';
import { extractAuthor, extractCmid, extractMessageText, extractTime } from '../_shared/message-dom.js';
import { detectConversationContext } from '../dialog-export/peer.js';
import type { HistoryResponse, VKMessage } from '../dialog-export/types.js';
import { domAttachments, messageAttachments } from '../pin-note/attachments.js';
import { extractNoteAuthor } from '../pin-note/author.js';

/** Capture DOM before awaiting: VK can recycle message nodes while scrolling. */
export async function copyContent(blocks: Element[], withHeaders: boolean): Promise<string[]> {
  const context = detectConversationContext();
  const snapshots = blocks.map(block => ({
    cmid: extractCmid(block), text: extractMessageText(block), author: extractAuthor(block),
    authorId: extractNoteAuthor(block).authorId, time: extractTime(block), attachments: domAttachments(block),
  }));
  const messages = new Map<number, VKMessage>();
  const names = new Map<number, string>();
  const api = getService(SERVICES.vkApi);
  if (context) {
    const ids = snapshots.map(s => s.cmid).filter((id): id is number => id !== null);
    for (let offset = 0; offset < ids.length; offset += 100) {
      try {
        const data = await api.call('messages.getByConversationMessageId', {
          peer_id: context.peerId, conversation_message_ids: ids.slice(offset, offset + 100).join(','), extended: 1,
          ...(context.groupId !== null ? { group_id: context.groupId } : {}),
        }) as HistoryResponse | null;
        for (const m of data?.items ?? []) if (m.conversation_message_id !== undefined) messages.set(m.conversation_message_id, m);
        for (const p of data?.profiles ?? []) names.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim());
        for (const g of data?.groups ?? []) names.set(-g.id, g.name);
      } catch { /* Retain captured DOM content when API access is unavailable. */ }
    }
  }
  for (const s of snapshots) if (s.authorId && s.author) names.set(s.authorId, s.author);
  const missing = [...new Set(snapshots.map(s => (s.cmid !== null ? messages.get(s.cmid)?.from_id : undefined) ?? s.authorId)
    .filter((id): id is number => !!id && !names.get(id)))];
  for (const group of [false, true]) {
    const ids = missing.filter(id => (id < 0) === group);
    if (!ids.length) continue;
    try {
      const result = await api.call(group ? 'groups.getById' : 'users.get', {
        [group ? 'group_ids' : 'user_ids']: ids.map(Math.abs).join(','),
      }) as unknown;
      const entries = Array.isArray(result) ? result : (result as { groups?: unknown[] } | null)?.groups ?? [];
      for (const raw of entries) {
        const p = raw as { id: number; name?: string; first_name?: string; last_name?: string };
        names.set(group ? -p.id : p.id, group ? p.name || '' : [p.first_name, p.last_name].filter(Boolean).join(' '));
      }
    } catch { /* Explicit sender identity below remains available. */ }
  }
  return snapshots.map(s => {
    const message = s.cmid !== null ? messages.get(s.cmid) : undefined;
    const id = message?.from_id ?? s.authorId;
    const author = (id ? names.get(id) : '') || s.author || (id ? `https://vk.ru/${id < 0 ? 'club' + -id : 'id' + id}` : 'Автор неизвестен');
    const source = context && s.cmid !== null
      ? `https://vk.ru/${context.groupId ? `gim${context.groupId}` : 'im'}/convo/${context.peerId}?cmid=${s.cmid}` : undefined;
    const attachments = message ? messageAttachments(message, source) : s.attachments;
    const text = s.text || message?.text || '';
    const urls = [...new Set(attachments.map(a => a.url))].filter(url => !text.includes(url));
    const body = [text, ...urls].filter(Boolean).join('\n') || source || '';
    return body ? (withHeaders ? `[${[s.time, author].filter(Boolean).join(' ')}] ${body}` : body) : '';
  }).filter(Boolean);
}
