import type { NotificationPayload } from './types.js';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Pure Telegram message formatting, deliberately independent of Chrome/DOM. */
export function formatTelegramMessage(payload: NotificationPayload): string {
  const priority = payload.priority === 'high' ? '[!] ' : '';
  const url = payload.type === 'vk.message' && typeof payload.data?.url === 'string' && /^https:\/\/vk\.ru\/im\?sel=[^\s"<>]+$/.test(payload.data.url) ? payload.data.url : null;
  return `${priority}<b>${escapeHtml(payload.title.trim())}</b>\n${escapeHtml(payload.body.trim())}${url ? '\n\n<a href="' + escapeHtml(url) + '">VK →</a>' : ''}`;
}

