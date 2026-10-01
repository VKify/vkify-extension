import { object, peerUrl } from '../center-tools.js';
import type { NotificationPayload } from './types.js';

export function incomingMessagePayload(raw: unknown, peer: number, dialog: string, sender: string, owner: string, preview: boolean, english: boolean): NotificationPayload | null {
  const m = object(raw), cmid = Number(m.conversation_message_id), date = Number(m.date);
  if (!Number.isSafeInteger(cmid) || cmid <= 0 || !date || m.out === 1 || m.out === true || Number(m.from_id) === Number(owner) || m.action) return null;
  const crop = (s: string, length: number) => Array.from(s).slice(0, length).join('');
  const text = typeof m.text === 'string' ? m.text.trim() : '';
  const attachments = Array.isArray(m.attachments) ? m.attachments.length : 0;
  const forwarded = Array.isArray(m.fwd_messages) ? m.fwd_messages.length : 0;
  const parts = preview ? [text, attachments ? `${english ? 'Attachments' : 'Вложения'}: ${attachments}` : '',
    forwarded ? `${english ? 'Forwarded messages' : 'Пересланные сообщения'}: ${forwarded}` : ''].filter(Boolean) : [];
  return { type: 'vk.message', title: crop(peer >= 2000000000 && sender !== dialog ? `${sender} · ${dialog}` : dialog, 200),
    body: crop(parts.join('\n') || (english ? 'New message in VK' : 'Новое сообщение в VK'), 3000),
    data: { url: peerUrl(peer, cmid) }, dedupeKey: `vk.message:${owner}:${peer}:${cmid}` };
}

export function messageSender(raw: unknown, id: number): string {
  const data = object(raw), profiles = Array.isArray(data.profiles) ? data.profiles.map(object) : [];
  const groups = Array.isArray(data.groups) ? data.groups.map(object) : [];
  const profile = profiles.find(p => Number(p.id) === id), group = groups.find(g => Number(g.id) === -id);
  return String(id < 0 ? group?.name || `ID ${id}` : [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || `ID ${id}`);
}
