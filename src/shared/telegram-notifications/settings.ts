import { normalizeTelegramChatId, type TelegramNotificationSettings } from './types.js';

export function readTelegramSettings(raw: Record<string, unknown>): TelegramNotificationSettings {
  const ttlSeconds = typeof raw.telegram_dedupe_ttl_seconds === 'number'
    ? raw.telegram_dedupe_ttl_seconds
    : 60;
  return {
    enabled: raw.telegram_notifications_enabled === true,
    messagesEnabled: raw.telegram_messages_enabled === true,
    spyActivityEnabled: raw.telegram_spy_activity_enabled !== false,
    spyOnlineEnabled: raw.telegram_spy_online_enabled !== false,
    spyProfileEnabled: raw.telegram_spy_profile_enabled !== false,
    botToken: typeof raw.telegram_bot_token === 'string' ? raw.telegram_bot_token.trim() : '',
    chatId: typeof raw.telegram_chat_id === 'string' ? normalizeTelegramChatId(raw.telegram_chat_id) : '',
    dedupeTtlMs: Math.min(86_400, Math.max(1, ttlSeconds)) * 1000,
  };
}

