

import { normalizeAttachments } from '@/shared/telegram-notifications/attachments.js';
import { isVkPhotoUrl } from '@/shared/telegram-notifications/photos.js';

export interface SpyLogLine {
  timestamp: number;
  icon: string;
  userName: string;
  userId: string;
  action: string;
  extra?: { text?: string; photos?: unknown; attachments?: unknown };
}

/** Имя файла лога с датой: `vk-<kind>-spy-log-YYYY-MM-DD.txt`. */
export function spyLogFilename(kind: string): string {
  return `vk-${kind}-spy-log-${new Date().toISOString().split('T')[0]}.txt`;
}

/** Форматирует записи лога (с полем action) в построчный текст. */
export function formatSpyLog(log: SpyLogLine[]): string {
  return log
    .map(e => {
      const photos = Array.isArray(e.extra?.photos) ? e.extra.photos.filter(isVkPhotoUrl).slice(0, 10) : [];
      const attachments = normalizeAttachments(e.extra?.attachments);
      return [`[${new Date(e.timestamp).toLocaleString()}] ${e.userName} (${e.userId}): ${e.action}`,
        e.extra?.text, ...photos, ...attachments.map(a => `${a.title}: ${a.url}`)].filter(Boolean).join('\n');
    })
    .join('\n');
}
