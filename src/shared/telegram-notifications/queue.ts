import { isValidPayload } from './notifier.js';
import { isValidTelegramBotToken, isValidTelegramChatId, normalizeTelegramChatId, type NotificationPayload, type SendResult, type TelegramNotificationSettings, type TelegramNotifier } from './types.js';

export const TELEGRAM_QUEUE_KEY = 'telegram_delivery_queue';
export const TELEGRAM_QUEUE_ALARM = 'telegramDeliveryQueue';
export interface QueueItem {
  id: string; context: string; payload: NotificationPayload; createdAt: number;
  attempts: number; nextAttemptAt: number; status: 'pending' | 'sending' | 'retry' | 'blocked'; error?: string;
}
interface Receipt { key: string; expiresAt: number; messageId?: number }
export interface TelegramQueueState {
  version: 1; items: QueueItem[]; receipts: Receipt[]; delivered: number;
  recent: { id: string; title: string; sentAt: number; messageId?: number }[];
  updatedAt: number;
  cooldownUntil?: number;
  batchTotal?: number;
  batchDelivered?: number;
}
export interface QueueDependencies {
  read: () => Promise<TelegramQueueState | undefined>;
  write: (state: TelegramQueueState) => Promise<void>;
  readSettings: () => Promise<TelegramNotificationSettings>;
  transport: TelegramNotifier;
  ensureAlarm: () => Promise<void>;
  now?: () => number;
  pause?: () => Promise<void>;
}
const empty = (): TelegramQueueState => ({ version: 1, items: [], receipts: [], delivered: 0, recent: [], updatedAt: 0 });
const context = (s: TelegramNotificationSettings) => JSON.stringify([s.botToken.split(':')[0], normalizeTelegramChatId(s.chatId).toLowerCase()]);
const key = (item: QueueItem) => JSON.stringify([item.context, item.payload.dedupeKey || item.id]);

function skipped(s: TelegramNotificationSettings, p: NotificationPayload): SendResult | undefined {
  if (!isValidTelegramBotToken(s.botToken) || !isValidTelegramChatId(s.chatId)) return { success: true, status: 'skipped', reason: 'not_configured' };
  if (!s.enabled && p.type !== 'system.test') return { success: true, status: 'skipped', reason: 'disabled' };
  if (p.type.startsWith('spy.')) {
    const allowed = p.type.startsWith('spy.profile.') ? s.spyProfileEnabled !== false : ['spy.online', 'spy.offline'].includes(p.type) ? s.spyOnlineEnabled !== false : s.spyActivityEnabled !== false;
    if (!allowed || s.messagesEnabled && p.type === 'spy.new_message') return { success: true, status: 'skipped', reason: 'filtered' };
  }
  if (p.type === 'vk.message' && (!s.messagesEnabled || p.data?.telegramRecipient !== s.chatId || p.data?.telegramBotId !== s.botToken.split(':')[0])) return { success: true, status: 'skipped', reason: 'filtered' };
}

export function queueItemStatus(item: QueueItem, settings: TelegramNotificationSettings): QueueItem['status'] | 'paused' | 'other_recipient' {
  if (item.context !== context(settings)) return 'other_recipient';
  if (skipped(settings, item.payload)) return 'paused';
  return item.status;
}

/** Durable outbox. Only the background owns writes; network I/O never holds the mutation lock. */
export class PersistentTelegramQueue implements TelegramNotifier {
  private state = empty();
  private loaded?: Promise<void>;
  private lock: Promise<unknown> = Promise.resolve();
  private draining?: Promise<void>;
  private readonly now: () => number;
  private configured = false;
  constructor(private readonly deps: QueueDependencies) { this.now = deps.now ?? Date.now; }
  isConfigured(): boolean { return this.configured; }

  private mutate<T>(fn: (state: TelegramQueueState) => T): Promise<T> {
    const job = this.lock.then(async () => {
      const next = structuredClone(this.state);
      const result = fn(next);
      next.updatedAt = this.now();
      await this.deps.write(next); // Never acknowledge acceptance until durable.
      this.state = next;
      return result;
    });
    this.lock = job.catch(() => undefined);
    return job;
  }
  async restore(): Promise<void> {
    if (!this.loaded) this.loaded = (async () => {
      await this.deps.ensureAlarm();
      const saved = await this.deps.read();
      if (saved?.version === 1) this.state = saved;
      await this.mutate(s => {
        for (const item of s.items) if (item.status === 'sending') {
          item.status = 'retry'; item.nextAttemptAt = this.now();
          item.error = 'DELIVERY_UNCONFIRMED';
        }
      });
    })().catch(error => { this.loaded = undefined; throw error; });
    await this.loaded;
  }
  async send(payload: NotificationPayload): Promise<SendResult> {
    if (!isValidPayload(payload)) return { success: false, status: 'error', error: 'INVALID_PAYLOAD' };
    try {
      await this.restore();
      const settings = await this.deps.readSettings();
      this.configured = isValidTelegramBotToken(settings.botToken) && isValidTelegramChatId(settings.chatId);
      const skip = skipped(settings, payload);
      if (skip) return skip;
      const item: QueueItem = { id: crypto.randomUUID(), context: context(settings), payload, createdAt: this.now(), attempts: 0, nextAttemptAt: this.now(), status: 'pending' };
      const result = await this.mutate<SendResult>(s => {
        s.receipts = s.receipts.filter(r => r.expiresAt > this.now());
        if (payload.dedupeKey && (s.items.some(i => key(i) === key(item)) || s.receipts.some(r => r.key === key(item)))) return { success: true, status: 'skipped', reason: 'duplicate' };
        if (!s.items.length) { s.batchTotal = 0; s.batchDelivered = 0; }
        s.batchTotal = (s.batchTotal ?? s.items.length) + 1;
        s.items.push(item);
        return { success: true, status: 'queued', queueId: item.id };
      });
      void this.drain().catch(error => console.warn('[VKify] Telegram queue:', error));
      return result;
    } catch { return { success: false, status: 'error', error: 'QUEUE_STORAGE_UNAVAILABLE' }; }
  }
  drain(): Promise<void> {
    if (!this.draining) this.draining = this.run().finally(() => { this.draining = undefined; });
    return this.draining;
  }
  async retry(): Promise<void> {
    await this.restore();
    await this.mutate(s => {
      for (const item of s.items) if (item.status !== 'sending') item.nextAttemptAt = this.now();
    });
    void this.drain().catch(error => console.warn('[VKify] Telegram queue:', error));
  }
  private async run(): Promise<void> {
    await this.restore();
    const started = this.now();
    for (let count = 0; count < 10 && this.now() - started < 20_000; count++) {
      if ((this.state.cooldownUntil ?? 0) > this.now()) return;
      const settings = await this.deps.readSettings();
      const item = await this.mutate(s => {
        const candidate = s.items.find(i => i.status !== 'sending' && i.nextAttemptAt <= this.now() && i.context === context(settings) && !skipped(settings, i.payload));
        if (!candidate) return undefined;
        candidate.status = 'sending'; candidate.attempts++;
        return structuredClone(candidate);
      });
      if (!item) return;
      let result: SendResult;
      try { result = await this.deps.transport.send(item.payload); }
      catch { result = { success: false, status: 'error', error: 'NETWORK_ERROR' }; }
      await this.mutate(s => {
        const current = s.items.find(i => i.id === item.id);
        if (!current) return;
        if (result.success && (result.status === 'sent' || result.status === 'skipped' && result.reason === 'duplicate')) {
          const messageId = result.status === 'sent' ? result.messageId : undefined;
          const durableEvent = item.payload.type === 'vk.message' || ['spy.delete', 'spy.edit', 'spy.new_message'].includes(item.payload.type);
          s.receipts.push({ key: key(item), expiresAt: this.now() + (durableEvent ? 30 * 86400_000 : settings.dedupeTtlMs), messageId });
          s.items = s.items.filter(i => i.id !== item.id);
          s.delivered++; s.recent.unshift({ id: item.id, title: item.payload.title, sentAt: this.now(), messageId }); s.recent = s.recent.slice(0, 10);
          s.batchDelivered = (s.batchDelivered ?? 0) + 1;
        } else {
          current.status = !result.success && result.retryable === false ? 'blocked' : 'retry';
          current.error = !result.success ? result.error : result.status === 'skipped' ? result.reason : 'DELIVERY_UNCONFIRMED';
          current.nextAttemptAt = this.now() + (!result.success && result.retryAfterMs ? result.retryAfterMs : Math.min(15 * 60_000, 5000 * 2 ** Math.min(current.attempts - 1, 8)));
          if (!result.success && result.retryAfterMs || result.success && result.status === 'skipped' && result.reason === 'rate_limited') {
            s.cooldownUntil = this.now() + (!result.success ? result.retryAfterMs! : 60_000);
          }
        }
        s.receipts = s.receipts.filter(r => r.expiresAt > this.now());
      });
      await (this.deps.pause?.() ?? new Promise(resolve => setTimeout(resolve, 1100)));
    }
  }
}
