import type { NotificationPayload } from './types.js';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Pure Telegram message formatting, deliberately independent of Chrome/DOM. */
export function formatTelegramMessage(payload: NotificationPayload): string {
  const priority = payload.priority === 'high' ? '🔴 ' : payload.priority === 'low' ? '⚪ ' : '';
  return `${priority}<b>${escapeHtml(payload.title.trim())}</b>\n${escapeHtml(payload.body.trim())}`;
}

