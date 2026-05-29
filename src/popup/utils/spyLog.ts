import { downloadText } from '../../shared/utils/download.js';

export interface SpyLogLine {
  timestamp: number;
  icon: string;
  userName: string;
  userId: string;
  action: string;
}

/** Имя файла лога с датой: `vk-<kind>-spy-log-YYYY-MM-DD.txt`. */
export function spyLogFilename(kind: string): string {
  return `vk-${kind}-spy-log-${new Date().toISOString().split('T')[0]}.txt`;
}

/** Форматирует записи лога (с полем action) в построчный текст. */
export function formatSpyLog(log: SpyLogLine[]): string {
  return log
    .map(e => `[${new Date(e.timestamp).toLocaleString()}] ${e.icon} ${e.userName} (${e.userId}): ${e.action}`)
    .join('\n');
}
