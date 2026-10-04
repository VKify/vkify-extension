import { describe, expect, it, vi } from 'vitest';
import { PersistentTelegramQueue, type QueueDependencies, type TelegramQueueState } from './queue.js';
import { BackgroundTelegramNotifier } from './notifier.js';
import type { NotificationPayload, SendResult, TelegramNotificationSettings } from './types.js';

const payload = (id = 1): NotificationPayload => ({ type: 'spy.delete', title: 'Alice', body: 'Deleted', dedupeKey: `delete:7:${id}` });
function setup() {
  let state: TelegramQueueState | undefined;
  let now = 1000;
  const settings: TelegramNotificationSettings = { enabled: true, botToken: '123:token', chatId: '456', dedupeTtlMs: 1000 };
  const send = vi.fn<(p: NotificationPayload) => Promise<SendResult>>().mockResolvedValue({ success: true, status: 'sent', messageId: 42 });
  const write = vi.fn(async (value: TelegramQueueState) => { state = structuredClone(value); });
  const ensureAlarm = vi.fn(async () => {});
  const deps: QueueDependencies = { read: async () => structuredClone(state), write, readSettings: async () => ({ ...settings }), transport: { send, isConfigured: () => true }, ensureAlarm, now: () => now, pause: async () => {} };
  return { deps, settings, send, write, ensureAlarm, state: () => state!, advance: (ms: number) => { now += ms; } };
}

describe('durable Telegram delivery', () => {
  it('acknowledges durable acceptance before delivery and stores Telegram receipts', async () => {
    const f = setup();
    f.send.mockImplementation(async () => {
      expect(f.state().items[0].status).toBe('sending');
      return { success: true, status: 'sent', messageId: 99 };
    });
    const queue = new PersistentTelegramQueue(f.deps);
    expect(await queue.send(payload())).toMatchObject({ status: 'queued' });
    await queue.drain();
    expect(f.state().items).toEqual([]);
    expect(f.state().recent[0].messageId).toBe(99);
    expect(f.state().delivered).toBe(1);
    expect(f.ensureAlarm).toHaveBeenCalledTimes(1);
  });

  it('restores failed delivery after worker restart and deduplicates confirmed events beyond transient TTL', async () => {
    const f = setup();
    f.send.mockResolvedValueOnce({ success: false, status: 'error', error: 'Offline' });
    const queue = new PersistentTelegramQueue(f.deps);
    await queue.send(payload()); await queue.drain();
    expect(f.state().items[0]).toMatchObject({ status: 'retry', attempts: 1, nextAttemptAt: 6000 });
    f.advance(5000);
    const restarted = new PersistentTelegramQueue(f.deps);
    await restarted.drain();
    expect(f.state().items).toHaveLength(0);
    f.advance(60_000);
    expect(await new PersistentTelegramQueue(f.deps).send(payload())).toMatchObject({ reason: 'duplicate' });
    expect(f.send).toHaveBeenCalledTimes(2);
  });

  it('serializes concurrent duplicate submissions and network requests', async () => {
    const f = setup(); const queue = new PersistentTelegramQueue(f.deps);
    const results = await Promise.all(Array.from({ length: 12 }, () => queue.send(payload())));
    await queue.drain();
    expect(results.filter(r => r.status === 'queued')).toHaveLength(1);
    expect(f.send).toHaveBeenCalledTimes(1);
  });

  it('honors Telegram retry_after globally and across restarts', async () => {
    const f = setup(); f.send.mockResolvedValueOnce({ success: false, status: 'error', error: 'Too Many Requests', retryAfterMs: 120_000, retryable: true });
    const queue = new PersistentTelegramQueue(f.deps);
    await Promise.all([queue.send(payload(1)), queue.send(payload(2))]); await queue.drain();
    expect(f.send).toHaveBeenCalledTimes(1);
    f.advance(60_000); const restarted = new PersistentTelegramQueue(f.deps);
    await restarted.drain(); expect(f.send).toHaveBeenCalledTimes(1);
    await restarted.retry(); await restarted.drain(); expect(f.send).toHaveBeenCalledTimes(1);
    f.advance(60_000); await restarted.drain(); expect(f.send).toHaveBeenCalledTimes(3);
    expect(f.state().items).toHaveLength(0);
  });

  it('retains messages while disabled or configured for another recipient', async () => {
    const f = setup(); f.send.mockResolvedValueOnce({ success: false, status: 'error', error: 'Offline' });
    const queue = new PersistentTelegramQueue(f.deps);
    await queue.send(payload()); await queue.drain();
    f.advance(5000); f.settings.chatId = '999';
    await queue.drain(); expect(f.send).toHaveBeenCalledTimes(1);
    f.settings.chatId = '456'; f.settings.enabled = false;
    await queue.drain(); expect(f.state().items).toHaveLength(1);
    f.settings.enabled = true; await queue.retry(); await queue.drain();
    expect(f.send).toHaveBeenCalledTimes(2);
  });

  it('retains permanent errors, shows attempts, and resumes after connection fixes', async () => {
    const f = setup(); f.send.mockResolvedValueOnce({ success: false, status: 'error', error: 'Forbidden', retryable: false });
    const queue = new PersistentTelegramQueue(f.deps);
    await queue.send(payload()); await queue.drain();
    expect(f.state().items[0]).toMatchObject({ status: 'blocked', attempts: 1, error: 'Forbidden' });
    await queue.retry(); await queue.drain();
    expect(f.state().items).toEqual([]);
  });

  it('recovers an interrupted in-flight item without dropping it', async () => {
    const f = setup();
    await f.write({ version: 1, items: [{ id: 'interrupted', context: JSON.stringify(['123', '456']), payload: payload(), createdAt: 1, attempts: 1, nextAttemptAt: 1, status: 'sending' }], receipts: [], delivered: 0, recent: [], updatedAt: 1 });
    await new PersistentTelegramQueue(f.deps).drain();
    expect(f.send).toHaveBeenCalledTimes(1); expect(f.state().delivered).toBe(1);
  });

  it('never claims acceptance or starts delivery if storage rejects the item', async () => {
    const f = setup(); const original = f.deps.write;
    f.deps.write = async state => { if (state.items.length) throw new Error('Quota'); await original(state); };
    const queue = new PersistentTelegramQueue(f.deps);
    expect(await queue.send(payload())).toMatchObject({ status: 'error', error: 'QUEUE_STORAGE_UNAVAILABLE' });
    expect(f.send).not.toHaveBeenCalled();
  });

  it('rejects disabled categories before enqueue and keeps credentials out of queue storage', async () => {
    const f = setup(); f.settings.spyActivityEnabled = false;
    const queue = new PersistentTelegramQueue(f.deps);
    expect(await queue.send(payload())).toMatchObject({ reason: 'filtered' });
    expect(f.state().items).toEqual([]);
    f.settings.spyActivityEnabled = true;
    await queue.send(payload()); await queue.drain();
    expect(JSON.stringify(f.state())).not.toContain(f.settings.botToken);
  });

  it('starts a fresh progress batch instead of counting earlier deliveries', async () => {
    const f = setup(); const queue = new PersistentTelegramQueue(f.deps);
    await queue.send(payload(1)); await queue.drain();
    expect(f.state()).toMatchObject({ batchTotal: 1, batchDelivered: 1 });
    f.send.mockResolvedValueOnce({ success: false, status: 'error', error: 'Offline' });
    await queue.send(payload(2)); await queue.drain();
    expect(f.state()).toMatchObject({ delivered: 1, batchTotal: 1, batchDelivered: 0 });
  });

  it('backs off real transport failures and persists the successful message ID', async () => {
    const f = setup(); const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, result: { message_id: 77 } })));
    f.deps.transport = new BackgroundTelegramNotifier({ readSettings: f.deps.readSettings, fetch: fetchMock, now: f.deps.now });
    const queue = new PersistentTelegramQueue(f.deps);
    await queue.send(payload()); await queue.drain();
    expect(f.state().items[0].status).toBe('retry');
    f.advance(5000); await queue.drain();
    expect(f.state().recent[0].messageId).toBe(77);
  });
});
