import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { MessageRelay, MESSAGE_RELAY_STATE, MESSAGE_RELAY_STATUS, MESSAGE_RELAY_ALARM } from './message-relay.js';
import { incomingMessagePayload } from '../../shared/telegram-notifications/messages.js';
import { formatTelegramMessage } from '../../shared/telegram-notifications/format.js';
import type { SendResult } from '../../shared/telegram-notifications/types.js';
let store: Record<string, unknown>, now: number;
const api = vi.fn<(method: string, params: Record<string, unknown>) => Promise<unknown>>();
const send = vi.fn<() => Promise<SendResult>>();
let relay: MessageRelay;
const message = (cmid: number, extra = {}) => ({ id: cmid, conversation_message_id: cmid, date: 101, from_id: 2, out: 0, text: '<hello>', ...extra });
const conversation = (peer = 2, extra = {}) => ({ conversation: { peer: { id: peer }, ...extra }, last_message: message(4, { date: 105 }) });
function setup(items = [conversation()], history = [message(4, { out: 1, from_id: 1 }), message(3), message(2), message(1, { date: 99 })]) {
  api.mockImplementation(async method => method === 'messages.getConversations' ? { count: items.length, items, profiles: [{ id: 2, first_name: 'Alice' }] }
    : { count: history.length, items: history, profiles: [{ id: 2, first_name: 'Alice' }] });
}
beforeEach(() => {
  vi.clearAllMocks(); now = 100000;
  store = { telegram_notifications_enabled: true, telegram_messages_enabled: true, telegram_bot_token: '123:token', telegram_chat_id: '456', vk_user_id: '1' };
  send.mockResolvedValue({ success: true, status: 'sent' });
  vi.stubGlobal('chrome', { alarms: { get: vi.fn(async () => undefined), create: vi.fn(), clear: vi.fn() } });
  relay = createRelay(); setup();
});
afterEach(() => vi.unstubAllGlobals());
function createRelay() { return new MessageRelay({
  read: async keys => Object.fromEntries(keys.map(k => [k, structuredClone(store[k])])),
  write: async data => { Object.assign(store, structuredClone(data)); },
  remove: async key => { delete store[key]; }, api, notifier: { send, isConfigured: () => true }, now: () => now, pause: async () => {},
}); }
async function baseline() { await relay.check(); now = 106000; }
it('advances checkpoints after durable queue acceptance without waiting for Telegram', async () => {
  await baseline();
  send.mockResolvedValue({ success: true, status: 'queued', queueId: 'saved' });
  await relay.check();
  expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ checkpoints: { '2': { cmid: 4 } } });
  send.mockClear();
  await relay.check();
  expect(send).not.toHaveBeenCalled();
});
it('starts without forwarding existing history and creates an opt-in alarm', async () => {
  await relay.syncAlarm(); expect(chrome.alarms.create).toHaveBeenCalledWith(MESSAGE_RELAY_ALARM, { periodInMinutes: 1 });
  await vi.waitFor(() => expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ since: 101 }));
  expect(api).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ since: 101 });
  store.telegram_messages_enabled = false; await relay.syncAlarm();
  expect(chrome.alarms.clear).toHaveBeenCalled(); expect(store[MESSAGE_RELAY_STATE]).toBeUndefined();
});
it('does not block worker initialization behind a slow VK request', async () => {
  await baseline();
  let resolve!: (value: unknown) => void;
  api.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await relay.syncAlarm();
  await vi.waitFor(() => expect(api).toHaveBeenCalled());
  relay.invalidate(); resolve({ count: 0, items: [] });
  expect(send).not.toHaveBeenCalled();
});
it('delivers incoming messages chronologically, ignores old/outgoing and persists dedupe across worker restart', async () => {
  await baseline(); await relay.check();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls.map(call => (call as unknown as [{ dedupeKey: string }])[0].dedupeKey)).toEqual(['vk.message:1:2:2', 'vk.message:1:2:3']);
  relay = createRelay(); now += 60000; await relay.check(); expect(send).toHaveBeenCalledTimes(2);
  expect(api.mock.calls.every(([method]) => method !== 'messages.markAsRead')).toBe(true);
});
it('retries failed delivery without replaying already delivered messages or advancing the scan window', async () => {
  await baseline(); send.mockResolvedValueOnce({ success: true, status: 'sent' }).mockResolvedValueOnce({ success: false, status: 'error', error: 'network' });
  await relay.check(); expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ since: 101, checkpoints: { '2': { cmid: 2 } } });
  expect(store[MESSAGE_RELAY_STATUS]).toMatchObject({ status: 'delivery_error' });
  await relay.check(); expect(send).toHaveBeenCalledTimes(3);
  expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ checkpoints: { '2': { cmid: 4 } } });
});
it('keeps a rate-limited message pending instead of silently dropping it', async () => {
  await baseline(); send.mockResolvedValueOnce({ success: true, status: 'skipped', reason: 'rate_limited' });
  await relay.check(); expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ checkpoints: {} });
  expect(store[MESSAGE_RELAY_STATUS]).toMatchObject({ status: 'rate_limited', pending: true });
  await relay.check(); expect(send).toHaveBeenCalledTimes(3);
});
it('skips quiet conversations and optional group chats', async () => {
  await baseline(); setup([conversation(2, { push_settings: { no_sound: true } }), conversation(2000000001)]);
  store.telegram_messages_chats = false;
  await relay.check(); // options change creates a baseline
  now += 60000; await relay.check();
  expect(send).not.toHaveBeenCalled();
});
it('discards responses after an account or recipient change', async () => {
  await baseline(); let resolve!: (value: unknown) => void;
  api.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const job = relay.check(); await vi.waitFor(() => expect(api).toHaveBeenCalled());
  store.telegram_chat_id = '999'; resolve({ count: 1, items: [conversation()] }); await job;
  expect(send).not.toHaveBeenCalled();
  await relay.check(); expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ since: 107 });
});
it('does not overlap polling and reports API permission errors', async () => {
  await baseline(); let reject!: (error: unknown) => void;
  api.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
  const job = relay.check(); await vi.waitFor(() => expect(api).toHaveBeenCalled()); await relay.check();
  expect(api).toHaveBeenCalledTimes(1); reject(Object.assign(new Error('Denied'), { code: '7' })); await job;
  expect(store[MESSAGE_RELAY_STATUS]).toMatchObject({ status: 'access_error' });
  expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ since: 101 });
});
it('paginates recent conversations and history without losing messages between pages', async () => {
  await baseline();
  api.mockImplementation(async (method, params) => {
    if (method === 'messages.getConversations') return Number(params.offset) === 0
      ? { count: 2, items: [conversation()], profiles: [{ id: 2, first_name: 'Alice' }] }
      : { count: 2, items: [conversation(3)], profiles: [{ id: 3, first_name: 'Bob' }] };
    return Number(params.offset) === 0 ? { count: 3, items: [message(4), message(3)] }
      : { count: 3, items: [message(2)] };
  });
  await relay.check(); expect(send).toHaveBeenCalledTimes(6);
  expect(api.mock.calls.filter(([method]) => method === 'messages.getConversations').map(([, p]) => p.offset)).toEqual([0, 1]);
  expect(api.mock.calls.filter(([method]) => method === 'messages.getHistory').map(([, p]) => p.offset)).toEqual([0, 2, 0, 2]);
});
it('does not let a departed or inaccessible chat block other conversations', async () => {
  await baseline();
  api.mockImplementation(async (method, params) => {
    if (method === 'messages.getConversations') return { count: 2, items: [conversation(2000000001), conversation()] };
    if (params.peer_id === 2000000001) throw Object.assign(new Error('Chat inaccessible'), { code: '917' });
    return { count: 1, items: [message(4)] };
  });
  await relay.check(); expect(send).toHaveBeenCalledTimes(1);
  expect(store[MESSAGE_RELAY_STATE]).toMatchObject({ checkpoints: { '2000000001': { cmid: 4 }, '2': { cmid: 4 } } });
});
it('formats text-free notifications, attachments, chat senders and safe original message links', () => {
  const payload = incomingMessagePayload(message(2, { text: '<script>', attachments: [{}] }), 2000000001, 'Team', 'Alice', '1', false, true)!;
  expect(payload.title).toBe('Alice · Team'); expect(payload.body).toBe('New message in VK');
  expect(formatTelegramMessage(payload)).toContain('https://vk.ru/im?sel=c1&amp;cmid=2');
  const preview = incomingMessagePayload(message(2, { attachments: [{}] }), 2, 'Alice', 'Alice', '1', true, true)!;
  expect(formatTelegramMessage(preview)).toContain('&lt;hello&gt;\nAttachments: 1');
  expect(incomingMessagePayload(message(2, { action: { type: 'chat_create' } }), 2, 'A', 'A', '1', true, false)).toBeNull();
});
