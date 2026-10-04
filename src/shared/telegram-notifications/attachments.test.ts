import { expect, it, vi } from 'vitest';
import { messageAttachments, normalizeAttachments, safeAttachmentUrl } from './attachments.js';
import { incomingMessagePayload } from './messages.js';
import { formatTelegramRichMessage } from './format.js';
import { telegramSettingsBackup } from './settings-backup.js';

it('includes voice, documents and video links, respects previews and escapes names', () => {
  const message = { conversation_message_id: 1, date: 100, from_id: 7, attachments: [
    { type: 'audio_message', audio_message: { link_ogg: 'https://psv4.vkuseraudio.net/voice.ogg' } },
    { type: 'doc', doc: { url: 'https://vk.com/doc/file.zip', title: '<b>Private</b>' } },
    { type: 'video', video: { owner_id: 7, id: 8, title: 'Video' } },
  ] };
  expect(messageAttachments(message).map(a => a.kind)).toEqual(['voice', 'document', 'link']);
  const payload = incomingMessagePayload(message, 7, 'Alice', 'Alice', '1', true, false)!;
  const html = formatTelegramRichMessage(payload).html;
  expect(html).toContain('<audio src="https://psv4.vkuseraudio.net/voice.ogg">');
  expect(html).toContain('<tg-document');
  expect(html).toContain('&lt;b&gt;Private&lt;/b&gt;');
  expect(html).toContain('https://vk.ru/video7_8');
  expect(incomingMessagePayload(message, 7, 'Alice', 'Alice', '1', false, false)?.data?.attachments).toEqual([]);
  expect(messageAttachments({ fwd_messages: [message] })).toEqual([]);
});

it('does not embed arbitrary or credential-bearing file URLs', () => {
  for (const url of ['https://localhost/a', 'https://127.0.0.1/a', 'https://userapi.com.evil.test/a', 'https://secret@userapi.com/a', 'file:///a']) expect(safeAttachmentUrl(url, true)).toBe(false);
  expect(normalizeAttachments([{ kind: 'document', url: 'https://evil.test/file', title: 'file' }])).toEqual([]);
});

it('exports a restorable snapshot without tokens, private runtime data or unknown keys', () => {
  vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '2.0.0' }) } });
  try {
    const backup = JSON.parse(telegramSettingsBackup({ hide_stories: true, telegram_bot_token: 'secret', vk_access_token: 'secret',
      spy_message_cache: { text: 'private' }, telegram_delivery_queue: { body: 'private' }, spy_log: ['private'], arbitrary_secret: 'private' }));
    expect(backup.version).toBe('2.0.0');
    expect(backup.settings).toEqual({ hide_stories: true });
  } finally { vi.unstubAllGlobals(); }
});
