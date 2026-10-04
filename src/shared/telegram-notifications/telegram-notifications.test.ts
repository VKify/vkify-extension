import { describe, expect, it, vi } from 'vitest';
import { formatTelegramMessage } from './format.js';
import { BackgroundTelegramNotifier } from './notifier.js';
import { readTelegramSettings } from './settings.js';
import { createProfileSpyNotificationPayload, createSpyNotificationPayload } from './spy.js';
import type { TelegramNotificationSettings } from './types.js';
import { isValidTelegramChatId, normalizeTelegramChatId } from './types.js';
import { formatTelegramRichMessage, telegramReplyMarkup } from './format.js';

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
  it('uploads settings as a JSON document, without falling back to a text notification', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse());
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => configured, fetch: fetchMock });
    expect(await notifier.send({ type: 'system.settings', title: 'VKify', body: 'Backup', data: { settingsDocument: '{"settings":{"hide_stories":true}}' } })).toMatchObject({ status: 'sent' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/sendDocument');
    const form = init?.body as FormData;
    expect(form.get('chat_id')).toBe(configured.chatId);
    expect(await (form.get('document') as Blob).text()).toContain('hide_stories');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    ['spyActivityEnabled', 'spy.typing', ['spy.online', 'spy.profile.avatar']],
    ['spyOnlineEnabled', 'spy.offline', ['spy.read', 'spy.profile.status']],
    ['spyProfileEnabled', 'spy.profile.friends_added', ['spy.online', 'spy.call']],
  ] as const)('filters %s independently of the other Telegram tracking categories', async (key, type, otherTypes) => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse());
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => ({ ...configured, [key]: false }), fetch: fetchMock });
    expect(await notifier.send({ type, title: 'Alice', body: 'Event' })).toMatchObject({ status: 'skipped', reason: 'filtered' });
    expect(fetchMock).not.toHaveBeenCalled();
    for (const other of otherTypes) expect(await notifier.send({ type: other, title: 'Alice', body: 'Event' })).toMatchObject({ status: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('keeps legacy Telegram tracking enabled and reads the new category switches', () => {
    expect(readTelegramSettings({})).toMatchObject({ spyActivityEnabled: true, spyOnlineEnabled: true, spyProfileEnabled: true });
    expect(readTelegramSettings({ telegram_spy_activity_enabled: false, telegram_spy_online_enabled: false, telegram_spy_profile_enabled: false })).toMatchObject({ spyActivityEnabled: false, spyOnlineEnabled: false, spyProfileEnabled: false });
  });
  it('lets the message relay own delivery and prevents routing to changed recipients', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>().mockResolvedValue(okResponse());
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => ({ ...configured, messagesEnabled: true }), fetch: fetchMock });
    const payload = createSpyNotificationPayload({ code: 10004, userId: 7, userName: 'Alice', action: 'sent', extra: { text: 'Private' } });
    expect(await notifier.send(payload)).toMatchObject({ status: 'skipped', reason: 'filtered' });
    expect(await notifier.send({ type: 'vk.message', title: 'Alice', body: 'Message', data: { telegramRecipient: 'old-chat', telegramBotId: '123456789' } })).toMatchObject({ reason: 'filtered' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await notifier.send({ type: 'vk.message', title: 'Alice', body: 'Message', data: { telegramRecipient: configured.chatId, telegramBotId: '123456789' } })).toMatchObject({ status: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
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
    expect(formatTelegramMessage(payload)).toContain('<b>Alice &lt;Admin&gt;</b>');
    expect(formatTelegramMessage(payload)).toContain('<blockquote>sent: &lt;hello&gt; &amp; bye</blockquote>');
    expect(telegramReplyMarkup(payload)?.inline_keyboard[0][0].url).toBe('https://vk.ru/id7');
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

  it.each(['avatar', 'status'] as const)('delivers %s with long values and still deduplicates repeats', async changeType => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse());
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => configured, fetch: fetchMock });
    const input = { userId: '7', userName: 'Alice', changeType, description: 'changed', before: 'old', after: 'https://cdn.vk.ru/' + 'a'.repeat(2000) };
    const payload = createProfileSpyNotificationPayload(input);
    expect(payload.dedupeKey!.length).toBeLessThan(240);
    expect(await notifier.send(payload)).toMatchObject({ status: 'sent' });
    expect(await notifier.send(createProfileSpyNotificationPayload(input))).toMatchObject({ reason: 'duplicate' });
    expect(await notifier.send(createProfileSpyNotificationPayload({ ...input, after: input.after + 'b' }))).toMatchObject({ status: 'sent' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ rich_message: { html: expect.any(String) }, reply_markup: { inline_keyboard: [[{ url: 'https://vk.ru/id7', style: 'primary' }]] } });
  });

  it('accepts usernames with and without @ and rejects malformed recipients', () => {
    for (const value of ['my_username', '@my_username', '123', '-100123']) expect(isValidTelegramChatId(value)).toBe(true);
    for (const value of ['@', 'bad name', '@bad/name', '@abc', 'x'.repeat(33)]) expect(isValidTelegramChatId(value)).toBe(false);
    expect(normalizeTelegramChatId(' my_username ')).toBe('@my_username');
    expect(readTelegramSettings({ telegram_chat_id: 'my_username' }).chatId).toBe('@my_username');
  });

  it('formats status comparisons and never includes arbitrary URLs in buttons', () => {
    const payload = createProfileSpyNotificationPayload({ userId: '7', userName: 'A', changeType: 'status', description: 'changed', before: '<old>', after: 'new & better' });
    expect(formatTelegramMessage(payload)).toContain('<b>Было</b>\n<blockquote>&lt;old&gt;</blockquote>');
    expect(formatTelegramMessage(payload)).toContain('<b>Стало</b>\n<blockquote>new &amp; better</blockquote>');
    expect(telegramReplyMarkup({ type: 'vk.message', title: 'A', body: 'B', data: { url: 'javascript:alert(1)' } })).toBeUndefined();
  });

  it('includes deleted message text as an escaped quote and explains missing cache', () => {
    const payload = createSpyNotificationPayload({ code: 10002, userId: 7, userName: 'Alice', action: 'удалил сообщение для всех', extra: { text: '<deleted> & text', messageId: 99 } });
    expect(payload.body).toContain('<deleted> & text');
    const rich = formatTelegramRichMessage(payload).html;
    expect(rich).toContain('<p>удалил сообщение для всех</p><blockquote>&lt;deleted&gt; &amp; text</blockquote>');
    expect(rich).not.toContain('Текст недоступен');
    expect(formatTelegramRichMessage(createSpyNotificationPayload({ code: 10002, userId: 7, userName: 'Alice', action: 'deleted' })).html).toContain('Текст недоступен');
    expect(formatTelegramRichMessage(createSpyNotificationPayload({ code: 10013, userId: 7, userName: 'Alice', action: 'cleared' })).html).not.toContain('Текст недоступен');
  });

  it('uses rich headings, inline photos and primary buttons', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okResponse());
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => ({ ...configured, messagesEnabled: true }), fetch: fetchMock });
    const payload = { type: 'vk.message', title: 'Alice', body: 'Photo', data: { telegramRecipient: configured.chatId, telegramBotId: '123456789', url: 'https://vk.ru/im?sel=7', photos: ['https://sun9.userapi.com/photo.jpg?a=1&b=2', 'javascript:alert(1)'] } };
    expect(await notifier.send(payload)).toMatchObject({ status: 'sent' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/sendRichMessage');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.rich_message.html).toContain('<h3>');
    expect(body.rich_message.html).toContain('<img src="https://sun9.userapi.com/photo.jpg?a=1&amp;b=2"/>');
    expect(body.rich_message.html).not.toContain('javascript:');
    expect(body.reply_markup.inline_keyboard[0][0].style).toBe('primary');
  });

  it('falls back after an explicit rich API rejection without losing deleted text', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, description: 'Not Found' }), { status: 404 })).mockResolvedValueOnce(okResponse());
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => configured, fetch: fetchMock });
    const payload = createSpyNotificationPayload({ code: 10002, userId: 7, userName: 'A', action: 'deleted', extra: { text: 'Original' } });
    expect(await notifier.send(payload)).toMatchObject({ status: 'sent' });
    expect(String(fetchMock.mock.calls[1][0])).toContain('/sendMessage');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).text).toContain('Original');
  });

  it.each([429, 500])('does not retry rich delivery after HTTP %i', async status => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status }));
    const notifier = new BackgroundTelegramNotifier({ readSettings: async () => configured, fetch: fetchMock });
    expect(await notifier.send({ type: 'system.test', title: 'A', body: 'B' })).toMatchObject({ status: 'error' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
