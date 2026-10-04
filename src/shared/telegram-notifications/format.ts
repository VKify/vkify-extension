import type { NotificationPayload } from './types.js';
import { isVkPhotoUrl } from './photos.js';
import { normalizeAttachments } from './attachments.js';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const EVENT_STYLE: Record<string, string> = {
  'system.test': '✅ Telegram подключён',
  'vk.message': '💬 Новое сообщение',
  'spy.new_message': '💬 Новое сообщение',
  'spy.online': '🟢 В сети',
  'spy.offline': '⚪ Не в сети',
  'spy.profile.avatar': '🖼 Новая аватарка',
  'spy.profile.status': '📝 Новый статус',
  'spy.profile.friends_added': '👥 Новые друзья',
  'spy.profile.friends_removed': '👥 Удаление друзей',
  'spy.typing': '✍️ Печатает',
  'spy.voice': '🎙 Голосовое сообщение',
  'spy.call': '📞 Звонок',
  'spy.edit': '✏️ Редактирование сообщения',
  'spy.delete': '🗑 Удаление сообщения',
  'spy.read': '👀 Сообщение прочитано',
};

function notificationUrl(payload: NotificationPayload): string | null {
  const url = payload.data?.url;
  if (payload.type === 'vk.message' && typeof url === 'string' && /^https:\/\/vk\.ru\/im\?sel=[^\s"<>]+$/.test(url)) return url;
  const userId = payload.data?.userId;
  return payload.type.startsWith('spy.') && typeof userId === 'string' && /^\d+$/.test(userId) ? `https://vk.ru/id${userId}` : null;
}

export function telegramReplyMarkup(payload: NotificationPayload): { inline_keyboard: { text: string; url: string; style: 'primary' }[][] } | undefined {
  const url = notificationUrl(payload);
  return url ? { inline_keyboard: [[{ text: payload.type === 'vk.message' ? '💬 Открыть сообщение' : '👤 Открыть профиль', url, style: 'primary' }]] } : undefined;
}

/** Rich HTML supports headings, separate media blocks, details and footers. */
export function formatTelegramRichMessage(payload: NotificationPayload): { html: string; skip_entity_detection: true } {
  const paragraph = (text: string) => escapeHtml(text).replace(/\n/g, '<br>');
  let content = `<blockquote>${paragraph(payload.body.trim())}</blockquote>`;
  if (['spy.delete', 'spy.edit', 'spy.new_message'].includes(payload.type) && typeof payload.data?.text === 'string' && payload.data.text) {
    content = `<p>${paragraph(typeof payload.data.action === 'string' ? payload.data.action : '')}</p>` +
      `<blockquote>${paragraph(payload.data.text.slice(0, 3500))}</blockquote>`;
  } else if (payload.type === 'spy.delete' && payload.data?.eventCode === 10002 && !(Array.isArray(payload.data?.photos) && payload.data.photos.some(isVkPhotoUrl)) && !normalizeAttachments(payload.data?.attachments).length) {
    content += '<p><i>Текст недоступен: исходное сообщение не было сохранено расширением.</i></p>';
  }
  if (payload.type === 'spy.profile.status') {
    const status = (value: unknown) => paragraph(typeof value === 'string' && value ? value.slice(0, 3500) : '(пусто)');
    content = `<table bordered compact><tr><th>Было</th><th>Стало</th></tr><tr><td>${status(payload.data?.before)}</td><td>${status(payload.data?.after)}</td></tr></table>`;
  }
  const photos = Array.isArray(payload.data?.photos) ? payload.data.photos.filter(isVkPhotoUrl).slice(0, 10) : [];
  const images = photos.map(url => `<img src="${escapeHtml(url)}"/>`).join('');
  if (images) content += photos.length > 1 ? `<tg-collage>${images}</tg-collage>` : images;
  for (const a of normalizeAttachments(payload.data?.attachments)) {
    const url = escapeHtml(a.url), title = escapeHtml(a.title);
    content += a.kind === 'link' ? `<p><a href="${url}">${title}</a></p>`
      : `<figure><${a.kind === 'document' ? 'tg-document' : a.kind === 'voice' ? 'audio' : a.kind} src="${url}"></${a.kind === 'document' ? 'tg-document' : a.kind === 'voice' ? 'audio' : a.kind}><figcaption>${title}</figcaption></figure>`;
  }
  const heading = EVENT_STYLE[payload.type] ?? '🔔 Событие VK';
  return { html: `<h3>${heading}</h3><p><b>${paragraph(payload.title.trim())}</b></p>${content}<hr/><footer>VKify</footer>`, skip_entity_detection: true };
}

/** Pure Telegram message formatting, deliberately independent of Chrome/DOM. */
export function formatTelegramMessage(payload: NotificationPayload): string {
  const heading = EVENT_STYLE[payload.type] ?? '🔔 Событие VK';
  let body = `<blockquote>${escapeHtml(payload.body.trim())}</blockquote>`;
  if (payload.type === 'spy.profile.status') {
    const status = (value: unknown) => escapeHtml(typeof value === 'string' && value ? Array.from(value).slice(0, 1000).join('') : '(пусто)');
    body = `<b>Было</b>\n<blockquote>${status(payload.data?.before)}</blockquote>\n<b>Стало</b>\n<blockquote>${status(payload.data?.after)}</blockquote>`;
  }
  const url = notificationUrl(payload);
  const photos = Array.isArray(payload.data?.photos) ? payload.data.photos.filter(isVkPhotoUrl).slice(0, 10) : [];
  const links = [...photos.map((photo, index) => `<a href="${escapeHtml(photo)}">📷 Фото ${index + 1}</a>`), ...normalizeAttachments(payload.data?.attachments).map(a => `<a href="${escapeHtml(a.url)}">${escapeHtml(a.title)}</a>`)].join('\n');
  return `<b>${heading}</b>\n<b>${escapeHtml(payload.title.trim())}</b>\n\n${body}${links ? '\n\n' + links : ''}\n\n<i>VKify</i>${url ? '\n<a href="' + escapeHtml(url) + '">VK →</a>' : ''}`;
}

