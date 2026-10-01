import { object, dialogPage } from '../../shared/center-tools.js';
import { incomingMessagePayload, messageSender } from '../../shared/telegram-notifications/messages.js';
import { isValidTelegramBotToken, isValidTelegramChatId, type TelegramNotifier } from '../../shared/telegram-notifications/types.js';

export const MESSAGE_RELAY_ALARM = 'telegramMessageRelay';
export const MESSAGE_RELAY_STATE = 'telegram_message_relay_state';
export const MESSAGE_RELAY_STATUS = 'telegram_message_relay_status';
export const MESSAGE_RELAY_KEYS = ['telegram_notifications_enabled', 'telegram_messages_enabled', 'telegram_messages_preview',
  'telegram_messages_chats', 'telegram_messages_respect_muted', 'telegram_bot_token', 'telegram_chat_id', 'vk_user_id', 'language'] as const;
interface RelayState { context: string; since: number; checkpoints: Record<string, { cmid: number; date: number }> }
interface RelayDependencies {
  read: (keys: readonly string[]) => Promise<Record<string, unknown>>;
  write: (data: Record<string, unknown>) => Promise<void>;
  remove: (key: string) => Promise<void>;
  api: (method: string, params: Record<string, unknown>) => Promise<unknown>;
  notifier: TelegramNotifier;
  now?: () => number;
  pause?: () => Promise<void>;
}
function config(raw: Record<string, unknown>) {
  const token = String(raw.telegram_bot_token || '').trim(), chat = String(raw.telegram_chat_id || '').trim(), owner = String(raw.vk_user_id || '');
  const preview = raw.telegram_messages_preview !== false, chats = raw.telegram_messages_chats !== false, muted = raw.telegram_messages_respect_muted !== false;
  return { enabled: raw.telegram_notifications_enabled === true && raw.telegram_messages_enabled === true,
    configured: isValidTelegramBotToken(token) && isValidTelegramChatId(chat) && /^\d+$/.test(owner),
    // Persist a bot identifier, never its token. Options changing start a fresh baseline.
    context: JSON.stringify([owner, token.split(':')[0], chat, preview, chats, muted]),
    token, chat, owner, preview, chats, muted, english: raw.language === 'en' };
}

/** Alarm-driven delivery, independent of open VK tabs. Never marks messages read.
 * Persist checkpoints after delivery; failed/rate-limited sends retain the scan window.
 * Re-enabling, account/recipient/options changes establish a new baseline, not a backlog.
 */
export class MessageRelay {
  private busy = false;
  private version = 0;
  private now: () => number;
  private pause: () => Promise<void>;
  constructor(private deps: RelayDependencies) {
    this.now = deps.now ?? Date.now;
    this.pause = deps.pause ?? (() => new Promise(resolve => setTimeout(resolve, 400)));
  }
  invalidate(): void { this.version++; }
  async syncAlarm(): Promise<void> {
    this.invalidate();
    const cfg = config(await this.deps.read(MESSAGE_RELAY_KEYS));
    if (cfg.enabled) {
      // Creating an existing alarm resets its next deadline, so only create if absent.
      if (!await chrome.alarms.get(MESSAGE_RELAY_ALARM)) await chrome.alarms.create(MESSAGE_RELAY_ALARM, { periodInMinutes: 1 });
      // Worker initialization must not hold popup requests behind a network scan.
      if (!this.busy) void this.check().catch(() => undefined);
    } else {
      await chrome.alarms.clear(MESSAGE_RELAY_ALARM);
      await this.deps.remove(MESSAGE_RELAY_STATE);
      await this.status('disabled');
    }
  }
  private status(status: string, pending = false): Promise<void> {
    return this.deps.write({ [MESSAGE_RELAY_STATUS]: { status, checkedAt: this.now(), pending } });
  }
  async check(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const version = this.version;
    try {
      const cfg = config(await this.deps.read(MESSAGE_RELAY_KEYS));
      if (!cfg.enabled) return;
      if (!cfg.configured) { await this.status('configuration'); return; }
      const current = async () => {
        if (version !== this.version) return false;
        const latest = config(await this.deps.read(MESSAGE_RELAY_KEYS));
        return latest.enabled && latest.configured && latest.context === cfg.context && latest.token === cfg.token;
      };
      const stored = object((await this.deps.read([MESSAGE_RELAY_STATE]))[MESSAGE_RELAY_STATE]);
      const started = Math.floor(this.now() / 1000);
      if (stored.context !== cfg.context || typeof stored.since !== 'number' || !stored.checkpoints || typeof stored.checkpoints !== 'object') {
        if (await current()) {
          await this.deps.write({ [MESSAGE_RELAY_STATE]: { context: cfg.context, since: started + 1, checkpoints: {} } });
          await this.status('ready');
        }
        return;
      }
      const state = stored as unknown as RelayState;
      const save = async () => { if (await current()) await this.deps.write({ [MESSAGE_RELAY_STATE]: state }); };
      let calls = 0;
      const request = async (method: string, params: Record<string, unknown>) => {
        if (!await current()) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
        if (++calls > 100) throw Object.assign(new Error('backlog'), { code: 'backlog' });
        if (calls > 1) await this.pause();
        const result = await this.deps.api(method, params);
        if (!await current()) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
        return result;
      };
      let offset = 0, stop = false;
      const visited = new Set<number>();
      while (!stop) {
        const raw = await request('messages.getConversations', { count: 200, offset, extended: 1, filter: 'all' });
        const page = dialogPage(raw), items = object(raw).items as unknown[];
        if (!items.length) break;
        for (const item of items) {
          const row = object(item), conversation = object(row.conversation), last = object(row.last_message), peer = Number(object(conversation.peer).id);
          if (Number(last.date) < state.since) continue;
          if (!Number.isSafeInteger(peer) || !peer || visited.has(peer)) continue;
          visited.add(peer);
          const checkpoint = Number(state.checkpoints[String(peer)]?.cmid) || 0;
          if (Number(last.conversation_message_id) <= checkpoint) continue;
          const push = object(conversation.push_settings);
          const muted = push.disabled_forever === true || Number(push.disabled_until) > started || push.no_sound === true;
          if ((!cfg.chats && peer >= 2000000000) || (cfg.muted && muted)) {
            state.checkpoints[String(peer)] = { cmid: Number(last.conversation_message_id) || checkpoint, date: Number(last.date) || started };
            await save(); continue;
          }
          const title = page.rows.find(d => d.id === peer)?.title || `ID ${peer}`;
          const messages: { raw: unknown; sender: string }[] = [];
          let historyOffset = 0;
          let historyDenied = false;
          while (true) {
            let history: Record<string, unknown>;
            try {
              history = object(await request('messages.getHistory', { peer_id: peer, count: 200, offset: historyOffset, rev: 0, extended: 1,
                ...(Number(last.id) > 0 ? { start_message_id: Number(last.id) } : {}) }));
            } catch (error) {
              if (!['15', '18', '917'].includes(String((error as { code?: unknown })?.code || ''))) throw error;
              historyDenied = true; break;
            }
            if (!Array.isArray(history.items)) throw new Error('INVALID_RESPONSE');
            for (const m of history.items.map(object)) {
              if (Number(m.date) >= state.since && Number(m.conversation_message_id) > checkpoint)
                messages.push({ raw: m, sender: messageSender(history, Number(m.from_id)) });
            }
            historyOffset += history.items.length;
            if (!history.items.length || historyOffset >= Number(history.count) || history.items.some(m => Number(object(m).date) < state.since || Number(object(m).conversation_message_id) <= checkpoint)) break;
          }
          if (historyDenied) {
            // Leaving a chat must not block notifications from every other dialog.
            state.checkpoints[String(peer)] = { cmid: Number(last.conversation_message_id) || checkpoint, date: Number(last.date) || started };
            await save(); continue;
          }
          messages.sort((a, b) => Number(object(a.raw).conversation_message_id) - Number(object(b.raw).conversation_message_id));
          for (const entry of messages) {
            const m = object(entry.raw), cmid = Number(m.conversation_message_id);
            if (cmid <= (state.checkpoints[String(peer)]?.cmid || 0)) continue;
            const payload = incomingMessagePayload(m, peer, title, entry.sender, cfg.owner, cfg.preview, cfg.english);
            if (!await current()) return;
            if (payload) {
              payload.data = { ...payload.data, telegramRecipient: cfg.chat, telegramBotId: cfg.token.split(':')[0] };
              const sent = await this.deps.notifier.send(payload);
              if (!await current()) return;
              if (!sent.success || sent.status === 'skipped' && sent.reason !== 'duplicate') {
                await this.status(!sent.success ? 'delivery_error' : sent.reason === 'rate_limited' ? 'rate_limited' : 'configuration', true);
                return;
              }
            }
            state.checkpoints[String(peer)] = { cmid, date: Number(m.date) || started };
            await save();
          }
        }
        offset += items.length;
        stop = offset >= page.count || items.every(item => Number(object(object(item).last_message).date) < state.since);
      }
      if (!await current()) return;
      // Overlap protects messages arriving while pages were being fetched; cmids dedupe.
      state.since = Math.max(state.since, started - 5);
      state.checkpoints = Object.fromEntries(Object.entries(state.checkpoints).sort((a, b) => b[1].date - a[1].date).slice(0, 5000));
      await save(); await this.status('ready');
    } catch (error) {
      if (version !== this.version) return;
      const code = String((error as { code?: unknown })?.code || '');
      if (code === 'cancelled') return;
      await this.status(['5', '7', '15', 'no_token', 'no_vk_tab', 'expired', 'TOKEN_EXPIRED'].includes(code) ? 'access_error' : code === 'backlog' ? 'backlog' : 'request_error', true);
    } finally { this.busy = false; }
  }
}
