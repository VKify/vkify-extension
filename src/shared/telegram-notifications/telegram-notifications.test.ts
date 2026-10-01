import { describe, expect, it, vi } from 'vitest';
import { formatTelegramMessage } from './format.js';
import { BackgroundTelegramNotifier } from './notifier.js';
import { createProfileSpyNotificationPayload, createSpyNotificationPayload } from './spy.js';
import type { TelegramNotificationSettings } from './types.js';

const configured: TelegramNotificationSettings = {
  enabled: true,
  botToken: '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcd',
  chatId: '-1001234567890',
  dedupeTtlMs: 10_000,
};

function okResponse(messageId = 42): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, result: { message_id: messageId } }),
  } as Response;
}

describe('Telegram notifications', () => {
  it('forms a spy payload and escapes Telegram HTML', () => {
    const payload = createSpyNotificationPayload({
      code: 10004,
      userId: 7,
      userName: 'Alice <Admin>',
      action: 'sent',
      extra: { messageId: 99, text: '<hello> & bye' },
    });

    expect(payload).toMatchObject({
      type: 'spy.new_message',
      body: 'sent: <hello> & bye',
      dedupeKey: 'spy.new_message:7:99',
      data: { userId: '7', messageId: 99 },
    });
    expect(formatTelegramMessage(payload!)).toBe('[!] <b>Alice &lt;Admin&gt;</b>\nsent: &lt;hello&gt; &amp; bye');
  });

  it.each([
    [52, 'spy.chat_event'], [63, 'spy.typing'], [64, 'spy.voice'],
    [65, 'spy.upload'], [66, 'spy.upload'], [67, 'spy.upload'],
    [81, 'spy.invisibility'], [90, 'spy.friend_event'], [115, 'spy.call'],
    [10002, 'spy.delete'], [10004, 'spy.new_message'], [10005, 'spy.edit'],
    [10007, 'spy.read'], [10013, 'spy.delete'],
  ])('duplicates tracked event %i as %s', (code, type) => {
    expect(createSpyNotificationPayload({ code, userId: 7, userName: 'Alice', action: 'event' }).type).toBe(type);
  });

  it('forms a notification for every profile-spy log change', () => {
    expect(createProfileSpyNotificationPayload({
      userId: '7', userName: 'Alice', changeType: 'status', description: 'changed status', before: 'a', after: 'b',
    })).toMatchObject({
      type: 'spy.profile.status',
      body: 'changed status',
      data: { userId: '7', changeType: 'status', before: 'a', after: 'b' },
    });
  });

  it('deduplicates by key and enforces the per-minute rate limit', async () => {
    let now = 1_000;
    const fetchMock = vi.fn(async () => okResponse());
    const notifier = new BackgroundTelegramNotifier({
      readSettings: async () => configured,
      fetch: fetchMock as unknown as typeof fetch,
      now: () => now,
      maxSendsPerMinute: 1,
    });
    const payload = { type: 'spy.typing', title: 'Alice', body: 'typing', dedupeKey: 'typing:7' };

    await expect(notifier.send(payload)).resolves.toMatchObject({ success: true, status: 'sent' });
    await expect(notifier.send(payload)).resolves.toEqual({ success: true, status: 'skipped', reason: 'duplicate' });

    now += 11_000;
    await expect(notifier.send({ ...payload, dedupeKey: 'typing:8' }))
      .resolves.toEqual({ success: true, status: 'skipped', reason: 'rate_limited' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a no-op result when Telegram is not configured', async () => {
    const fetchMock = vi.fn();
    const notifier = new BackgroundTelegramNotifier({
      readSettings: async () => ({ ...configured, botToken: '', chatId: '' }),
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(notifier.send({ type: 'spy.typing', title: 'Alice', body: 'typing' }))
      .resolves.toEqual({ success: true, status: 'skipped', reason: 'not_configured' });
    expect(notifier.isConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honours the master switch before network access', async () => {
    const fetchMock = vi.fn();
    const notifier = new BackgroundTelegramNotifier({
      readSettings: async () => ({ ...configured, enabled: false }),
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(notifier.send({ type: 'spy.read', title: 'Alice', body: 'read' }))
      .resolves.toEqual({ success: true, status: 'skipped', reason: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
