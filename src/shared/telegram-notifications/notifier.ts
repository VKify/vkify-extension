import { formatTelegramMessage, formatTelegramRichMessage, telegramReplyMarkup } from './format.js';
import { TelegramRecipientResolver, type RecipientDependencies } from './recipient.js';
import { isValidTelegramBotToken, isValidTelegramChatId, type NotificationPayload, type SendResult, type TelegramNotificationSettings, type TelegramNotifier } from './types.js';

export interface TelegramNotifierDependencies extends RecipientDependencies {
  readSettings: () => Promise<TelegramNotificationSettings>;
  fetch: typeof globalThis.fetch;
  now?: () => number;
  maxSendsPerMinute?: number;
  enrichPayload?: (payload: NotificationPayload) => Promise<NotificationPayload>;
}

export function isValidPayload(payload: NotificationPayload): boolean {
  return Boolean(
    payload &&
    typeof payload.type === 'string' && /^[a-z0-9_.-]{1,80}$/i.test(payload.type) &&
    typeof payload.title === 'string' && payload.title.trim().length > 0 && payload.title.length <= 200 &&
    typeof payload.body === 'string' && payload.body.trim().length > 0 && payload.body.length <= 3500 &&
    (payload.dedupeKey === undefined || (typeof payload.dedupeKey === 'string' && payload.dedupeKey.length <= 240)),
  );
}

/** Background-owned sender: one dedupe/rate-limit state for every extension context. */
export class BackgroundTelegramNotifier implements TelegramNotifier {
  private configured = false;
  private readonly dedupe = new Map<string, number>();
  private readonly sentAt: number[] = [];
  private readonly now: () => number;
  private readonly maxSendsPerMinute: number;
  private readonly recipients: TelegramRecipientResolver;

  constructor(private readonly deps: TelegramNotifierDependencies) {
    this.now = deps.now ?? Date.now;
    this.maxSendsPerMinute = deps.maxSendsPerMinute ?? 20;
    this.recipients = new TelegramRecipientResolver(deps);
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async refreshConfiguration(): Promise<boolean> {
    let settings: TelegramNotificationSettings;
    try {
      settings = await this.deps.readSettings();
    } catch {
      this.configured = false;
      return false;
    }
    this.configured = isValidTelegramBotToken(settings.botToken) && isValidTelegramChatId(settings.chatId);
    return this.configured;
  }

  async send(payload: NotificationPayload): Promise<SendResult> {
    if (!isValidPayload(payload)) return { success: false, status: 'error', error: 'INVALID_PAYLOAD' };

    let settings: TelegramNotificationSettings;
    try {
      settings = await this.deps.readSettings();
    } catch {
      return { success: false, status: 'error', error: 'SETTINGS_UNAVAILABLE' };
    }
    this.configured = isValidTelegramBotToken(settings.botToken) && isValidTelegramChatId(settings.chatId);
    if (!this.configured) {
      console.info('[VKify] Telegram notification skipped: not configured');
      return { success: true, status: 'skipped', reason: 'not_configured' };
    }
    if (!settings.enabled && payload.type !== 'system.test') {
      return { success: true, status: 'skipped', reason: 'disabled' };
    }
    if (payload.type.startsWith('spy.')) {
      const allowed = payload.type.startsWith('spy.profile.') ? settings.spyProfileEnabled !== false
        : payload.type === 'spy.online' || payload.type === 'spy.offline' ? settings.spyOnlineEnabled !== false
        : settings.spyActivityEnabled !== false;
      if (!allowed) return { success: true, status: 'skipped', reason: 'filtered' };
    }
    // The relay owns new-message delivery when enabled, including its preview
    // and mute settings. Activity spy continues logging locally without a second
    // Telegram copy (or leaking text when previews are disabled).
    if (settings.messagesEnabled && payload.type === 'spy.new_message') {
      return { success: true, status: 'skipped', reason: 'filtered' };
    }
    // A pending relay check must never deliver to a newly configured recipient.
    if (payload.type === 'vk.message' &&
      (!settings.messagesEnabled || payload.data?.telegramRecipient !== settings.chatId || payload.data?.telegramBotId !== settings.botToken.split(':')[0])) {
      return { success: true, status: 'skipped', reason: 'filtered' };
    }
    const now = this.now();
    for (const [key, expiresAt] of this.dedupe) if (expiresAt <= now) this.dedupe.delete(key);
    if (payload.dedupeKey && (this.dedupe.get(payload.dedupeKey) ?? 0) > now) {
      return { success: true, status: 'skipped', reason: 'duplicate' };
    }

    while (this.sentAt.length > 0 && this.sentAt[0] <= now - 60_000) this.sentAt.shift();
    if (this.sentAt.length >= this.maxSendsPerMinute) {
      return { success: true, status: 'skipped', reason: 'rate_limited' };
    }

    // Reserve before fetch so concurrent events also see dedupe/rate-limit state.
    if (payload.dedupeKey) this.dedupe.set(payload.dedupeKey, now + settings.dedupeTtlMs);
    this.sentAt.push(now);

    try {
      const chatId = await this.recipients.resolve(settings);
      if (this.deps.enrichPayload) payload = await this.deps.enrichPayload(payload).catch(() => payload);
      const request = async (method: string, body: Record<string, unknown>) => {
        const response = await this.deps.fetch(`https://api.telegram.org/bot${settings.botToken}/${method}`, {
          method: 'POST',
          signal: AbortSignal.timeout(15_000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, reply_markup: telegramReplyMarkup(payload), ...body }),
        });
        const data = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number }; description?: string; parameters?: { retry_after?: number } } | null;
        return { response, data };
      };
      let response: Response;
      let data: { ok?: boolean; result?: { message_id?: number }; description?: string; parameters?: { retry_after?: number } } | null;
      if (payload.type === 'system.settings') {
        const json = payload.data?.settingsDocument;
        if (typeof json !== 'string' || json.length > 2_000_000) throw new Error('INVALID_BACKUP');
        const form = new FormData();
        form.set('chat_id', chatId);
        form.set('caption', payload.body);
        form.set('document', new Blob([json], { type: 'application/json' }), `vkify-settings-${new Date(now).toISOString().replace(/[:.]/g, '-')}.json`);
        response = await this.deps.fetch(`https://api.telegram.org/bot${settings.botToken}/sendDocument`, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) });
        data = await response.json().catch(() => null);
      } else ({ response, data } = await request('sendRichMessage', { rich_message: formatTelegramRichMessage(payload) }));
      // Retry only explicit API rejection: timeouts/5xx may already have sent it.
      if (payload.type !== 'system.settings' && data?.ok === false && [400, 404].includes(response.status)) {
        ({ response, data } = await request('sendMessage', {
          text: formatTelegramMessage(payload), parse_mode: 'HTML', link_preview_options: { is_disabled: true },
        }));
      }
      if (!response.ok || data?.ok !== true) {
        if (payload.dedupeKey) this.dedupe.delete(payload.dedupeKey);
        this.sentAt.splice(this.sentAt.lastIndexOf(now), 1);
        return { success: false, status: 'error', error: (data?.description || `HTTP_${response.status}`).split(settings.botToken).join('[redacted]'),
          retryable: response.status === 429 || response.status >= 500,
          retryAfterMs: data?.parameters?.retry_after ? data.parameters.retry_after * 1000 : response.status === 429 ? 60_000 : undefined };
      }
      return { success: true, status: 'sent', messageId: data.result?.message_id };
    } catch (error) {
      if (payload.dedupeKey) this.dedupe.delete(payload.dedupeKey);
      this.sentAt.splice(this.sentAt.lastIndexOf(now), 1);
      return { success: false, status: 'error', error: error instanceof Error ? error.message.split(settings.botToken).join('[redacted]') : 'NETWORK_ERROR' };
    }
  }
}

