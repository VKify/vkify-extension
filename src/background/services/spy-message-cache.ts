import { SPY_MESSAGE_CACHE_KEY, messageCacheKey, normalizeCachedMessage, type CachedSpyMessage } from '../../shared/telegram-notifications/message-cache.js';
import type { NotificationPayload } from '../../shared/telegram-notifications/types.js';

interface CacheState { owner: string; messages: CachedSpyMessage[] }
interface Dependencies {
  read: () => Promise<CacheState | undefined>;
  write: (state: CacheState) => Promise<void>;
  owner: () => Promise<string>;
  now?: () => number;
}
export { SPY_MESSAGE_CACHE_KEY };

/** One serialized writer across VK tabs. Originals survive page/worker reloads. */
export class SpyMessageCache {
  private lock: Promise<unknown> = Promise.resolve();
  constructor(private readonly deps: Dependencies) {}
  remember(raw: unknown[], expectedOwner?: string): Promise<void> {
    const job = this.lock.then(async () => {
      const owner = await this.deps.owner();
      if (!owner || (expectedOwner !== undefined && expectedOwner !== owner)) return;
      const now = this.deps.now?.() ?? Date.now();
      const saved = await this.deps.read();
      const entries = new Map<string, CachedSpyMessage>();
      if (saved?.owner === owner) for (const m of saved.messages) if (now - m.savedAt < 86400_000) entries.set(messageCacheKey(m.peerId, m.cmid), m);
      for (const value of raw.slice(0, 200)) {
        const m = normalizeCachedMessage(value);
        if (!m) continue;
        const key = messageCacheKey(m.peerId, m.cmid), previous = entries.get(key);
        entries.delete(key);
        entries.set(key, { ...m, photos: m.photos.length ? m.photos : previous?.photos ?? [], attachments: m.attachments ?? previous?.attachments, savedAt: now });
      }
      const messages: CachedSpyMessage[] = [];
      let bytes = 0;
      for (const m of [...entries.values()].reverse()) {
        bytes += JSON.stringify(m).length * 2;
        if (messages.length >= 2000 || bytes > 2_000_000) break;
        messages.unshift(m);
      }
      await this.deps.write({ owner, messages });
    });
    this.lock = job.catch(() => undefined);
    return job;
  }
  async enrich(payload: NotificationPayload): Promise<NotificationPayload> {
    if (payload.type !== 'spy.delete' || payload.data?.eventCode !== 10002) return payload;
    await this.lock;
    const saved = await this.deps.read();
    if (saved?.owner !== await this.deps.owner()) return payload;
    const peerId = Number(payload.data?.peerId ?? payload.data?.userId), cmid = Number(payload.data?.messageId);
    const found = saved?.messages.find(m => m.peerId === peerId && m.cmid === cmid && (this.deps.now?.() ?? Date.now()) - m.savedAt < 86400_000);
    if (!found) return payload;
    const action = typeof payload.data?.action === 'string' ? payload.data.action : payload.body;
    return { ...payload, body: (found.text ? `${action}: ${found.text}` : action).slice(0, 3500),
      data: { ...payload.data, text: found.text || payload.data?.text, photos: found.photos.length ? found.photos : payload.data?.photos, attachments: found.attachments ?? payload.data?.attachments } };
  }
}
