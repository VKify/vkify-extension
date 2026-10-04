import { expect, it } from 'vitest';
import { isVkPhotoUrl, messagePhotos } from './photos.js';
import { incomingMessagePayload } from './messages.js';

const attachments = [{ type: 'photo', photo: { sizes: [
  { url: 'https://sun9.userapi.com/small.jpg', width: 100, height: 100 },
  { url: 'https://sun9.userapi.com/large.jpg', width: 1000, height: 1000 },
  { url: 'https://example.com/untrusted.jpg', width: 2000, height: 2000 },
] } }];

it('selects the largest valid photo and respects preview settings', () => {
  expect(messagePhotos({ attachments })).toEqual(['https://sun9.userapi.com/large.jpg']);
  const message = { conversation_message_id: 1, date: 100, from_id: 7, attachments };
  expect(incomingMessagePayload(message, 7, 'Alice', 'Alice', '1', true, false)?.data?.photos).toEqual(['https://sun9.userapi.com/large.jpg']);
  expect(incomingMessagePayload(message, 7, 'Alice', 'Alice', '1', false, false)?.data?.photos).toEqual([]);
});

it('rejects local, credential-bearing and lookalike URLs and limits media count', () => {
  for (const url of ['http://sun9.userapi.com/a', 'https://userapi.com.evil.test/a', 'https://secret@userapi.com/a', 'https://127.0.0.1/a', 'file:///a']) expect(isVkPhotoUrl(url)).toBe(false);
  const many = Array.from({ length: 20 }, (_, i) => ({ type: 'photo', photo: { sizes: [{ url: `https://sun9.userapi.com/${i}.jpg` }] } }));
  expect(messagePhotos({ attachments: many })).toHaveLength(10);
  expect(messagePhotos({ fwd_messages: [{ attachments }] })).toEqual([]);
});
