import { describe, expect, it, vi } from 'vitest';
import { BackgroundTelegramNotifier } from './notifier.js';
import type { ResolvedTelegramRecipient } from './recipient.js';

const settings = { enabled: true, botToken: '123:token', chatId: '@Alice', dedupeTtlMs: 1000 };
const payload = { type: 'system.test', title: 'Test', body: 'Connected' };
const response = (result: unknown, ok = true, description = '') => new Response(JSON.stringify({ ok, result, description }), { status: ok ? 200 : 400 });

describe('Telegram username recipients', () => {
  it('resolves only a matching private chat and persists the binding across worker restarts', async () => {
    let saved: ResolvedTelegramRecipient | undefined;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(null, false))
      .mockResolvedValueOnce(response([
        { message: { from: { username: 'Alice' }, chat: { id: -9, type: 'group' } } },
        { message: { chat: { id: 7, type: 'private', username: 'ALICE' } } },
        { message: { chat: { id: 8, type: 'private', username: 'Bob' } } },
      ]))
      .mockResolvedValueOnce(response({ id: 7, username: 'Alice', type: 'private' }))
      .mockResolvedValueOnce(response({ message_id: 1 }))
      .mockResolvedValueOnce(response({ id: 7, username: 'Alice', type: 'private' }))
      .mockResolvedValueOnce(response({ message_id: 2 }));
    const deps = { readSettings: async () => settings, fetch: fetchMock, readRecipient: async () => saved, saveRecipient: async (value: ResolvedTelegramRecipient) => { saved = value; } };
    expect(await new BackgroundTelegramNotifier(deps).send(payload)).toMatchObject({ status: 'sent' });
    expect(saved).toEqual({ botId: '123', username: 'alice', chatId: '7' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ limit: 100, timeout: 0 });
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).chat_id).toBe('7');
    expect(await new BackgroundTelegramNotifier(deps).send(payload)).toMatchObject({ status: 'sent' });
    expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body)).chat_id).toBe('7');
  });

  it('resolves channels without polling updates', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ id: -1007, type: 'channel' })).mockResolvedValueOnce(response({ message_id: 1 }));
    expect(await new BackgroundTelegramNotifier({ readSettings: async () => settings, fetch: fetchMock }).send(payload)).toMatchObject({ status: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).chat_id).toBe('-1007');
  });

  it.each([response([]), response(null, false, 'Conflict: webhook active')])('explains unresolved usernames and never sends to an unrelated chat', async updates => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response(null, false)).mockResolvedValueOnce(updates);
    const result = await new BackgroundTelegramNotifier({ readSettings: async () => settings, fetch: fetchMock }).send(payload);
    expect(result).toMatchObject({ status: 'error', error: expect.stringContaining('ID') });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).endsWith('/sendMessage'))).toBe(true);
  });

  it('rejects stale bindings when the username changes', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ id: 7, username: 'Bob' })).mockResolvedValueOnce(response(null, false)).mockResolvedValueOnce(response([]));
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => settings, fetch: fetchMock, readRecipient: async () => ({ botId: '123', username: 'alice', chatId: '7' }) });
    expect(await notifier.send(payload)).toMatchObject({ status: 'error' });
    expect(fetchMock.mock.calls.every(([url]) => !String(url).endsWith('/sendMessage'))).toBe(true);
  });

  it('does not reuse bindings from another bot', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(response(null, false)).mockResolvedValueOnce(response([]));
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => settings, fetch: fetchMock, readRecipient: async () => ({ botId: '999', username: 'alice', chatId: '7' }) });
    expect(await notifier.send(payload)).toMatchObject({ status: 'error' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).chat_id).toBe('@Alice');
  });
});
