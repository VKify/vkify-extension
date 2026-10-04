import { normalizeTelegramChatId, type TelegramNotificationSettings } from './types.js';

export interface ResolvedTelegramRecipient {
  botId: string;
  username: string;
  chatId: string;
}

export interface RecipientDependencies {
  fetch: typeof globalThis.fetch;
  readRecipient?: () => Promise<ResolvedTelegramRecipient | undefined>;
  saveRecipient?: (recipient: ResolvedTelegramRecipient) => Promise<void>;
}

interface Chat {
  id?: number;
  type?: string;
  username?: string;
}

/** Personal usernames must be resolved from a private message to this bot. */
export class TelegramRecipientResolver {
  constructor(private readonly deps: RecipientDependencies) {}

  private async request(token: string, method: string, body: Record<string, unknown>): Promise<{ ok?: boolean; result?: unknown; description?: string }> {
    const response = await this.deps.fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return await response.json();
  }

  async resolve(settings: TelegramNotificationSettings): Promise<string> {
    const recipient = normalizeTelegramChatId(settings.chatId);
    if (!recipient.startsWith('@')) return recipient;
    const username = recipient.slice(1).toLowerCase();
    const botId = settings.botToken.split(':')[0];
    const cached = await this.deps.readRecipient?.().catch(() => undefined);
    if (cached?.botId === botId && cached.username === username) {
      // Revalidate the username after worker restarts and username changes.
      const chat = await this.request(settings.botToken, 'getChat', { chat_id: cached.chatId });
      if (chat.ok && (chat.result as Chat)?.username?.toLowerCase() === username) return cached.chatId;
    }
    const publicChat = await this.request(settings.botToken, 'getChat', { chat_id: recipient });
    if (publicChat.ok && Number.isSafeInteger((publicChat.result as Chat)?.id)) {
      return String((publicChat.result as Chat).id);
    }
    // No offset/allowed_updates: do not consume updates or change bot subscriptions.
    const updates = await this.request(settings.botToken, 'getUpdates', { limit: 100, timeout: 0 });
    if (!updates.ok) {
      throw new Error(`Не удалось определить ID по username. Используйте числовой Chat ID. ${updates.description || ''}`.trim());
    }
    if (Array.isArray(updates.result)) {
      for (const update of [...updates.result].reverse()) {
        const chat = (update.message ?? update.edited_message)?.chat as Chat | undefined;
        if (chat?.type === 'private' && chat.username?.toLowerCase() === username && Number.isSafeInteger(chat.id)) {
          const chatId = String(chat.id);
          const current = await this.request(settings.botToken, 'getChat', { chat_id: chatId });
          if (!current.ok || (current.result as Chat)?.username?.toLowerCase() !== username) continue;
          await this.deps.saveRecipient?.({ botId, username, chatId });
          return chatId;
        }
      }
    }
    throw new Error('Username не найден. Отправьте боту /start в личном чате и повторите проверку, либо укажите числовой Chat ID.');
  }
}
