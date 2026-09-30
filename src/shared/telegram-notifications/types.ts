export type NotificationPriority = 'low' | 'normal' | 'high';

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
  dedupeKey?: string;
}

export type SendResult =
  | { success: true; status: 'sent'; messageId?: number }
  | { success: true; status: 'skipped'; reason: 'not_configured' | 'disabled' | 'filtered' | 'duplicate' | 'rate_limited' }
  | { success: false; status: 'error'; error: string };

export interface TelegramNotifier {
  send(payload: NotificationPayload): Promise<SendResult>;
  isConfigured(): boolean;
}

export interface TelegramNotificationSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  dedupeTtlMs: number;
}

export const TELEGRAM_SETTING_KEYS = [
  'telegram_notifications_enabled',
  'telegram_bot_token',
  'telegram_chat_id',
  'telegram_dedupe_ttl_seconds',
] as const;

export function isValidTelegramBotToken(value: string): boolean {
  return /^\d+:[A-Za-z0-9_-]+$/.test(value.trim());
}

export function isValidTelegramChatId(value: string): boolean {
  return /^(?:-?\d+|@[A-Za-z][A-Za-z0-9_]*)$/.test(value.trim());
}

