import type { TelegramNotificationSettings } from './types.js';

export function readTelegramSettings(raw: Record<string, unknown>): TelegramNotificationSettings {
  const ttlSeconds = typeof raw.telegram_dedupe_ttl_seconds === 'number'
    ? raw.telegram_dedupe_ttl_seconds
    : 60;
  return {
    enabled: raw.telegram_notifications_enabled === true,
    botToken: typeof raw.telegram_bot_token === 'string' ? raw.telegram_bot_token.trim() : '',
    chatId: typeof raw.telegram_chat_id === 'string' ? raw.telegram_chat_id.trim() : '',
    dedupeTtlMs: Math.min(86_400, Math.max(1, ttlSeconds)) * 1000,
  };
}

