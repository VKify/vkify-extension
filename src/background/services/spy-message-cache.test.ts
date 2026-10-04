import { expect, it } from 'vitest';
import { SpyMessageCache } from './spy-message-cache.js';
import { cachedMessagesFromResponse, type CachedSpyMessage } from '../../shared/telegram-notifications/message-cache.js';
import { createSpyNotificationPayload } from '../../shared/telegram-notifications/spy.js';
import { formatTelegramRichMessage } from '../../shared/telegram-notifications/format.js';

it('serializes concurrent originals, survives restart, and enriches every deletion with text/photos', async () => {
  let state: { owner: string; messages: CachedSpyMessage[] } | undefined;
  let owner = '123'; let now = Date.now();
  const deps = { read: async () => structuredClone(state), write: async (value: NonNullable<typeof state>) => { state = structuredClone(value); }, owner: async () => owner, now: () => now };
  const cache = new SpyMessageCache(deps);
  await Promise.all(Array.from({ length: 8 }, (_, id) => cache.remember([{ peerId: 7, cmid: id + 1, text: `Message ${id}`, photos: ['https://sun9.userapi.com/photo.jpg'] }])));
  expect(state?.messages).toHaveLength(8);
  const restarted = new SpyMessageCache(deps);
  for (let id = 1; id <= 8; id++) {
    const enriched = await restarted.enrich(createSpyNotificationPayload({ code: 10002, userId: 7, userName: 'Alice', action: 'deleted', extra: { messageId: id, peerId: 7 } }));
    expect(enriched.data?.text).toBe(`Message ${id - 1}`);
    expect(formatTelegramRichMessage(enriched).html).toContain('<img src="https://sun9.userapi.com/photo.jpg"/>');
  }
  const unrelated = createSpyNotificationPayload({ code: 10002, userId: 8, userName: 'B', action: 'deleted', extra: { messageId: 1, peerId: 8 } });
  expect(await restarted.enrich(unrelated)).toEqual(unrelated);
  owner = '999';
  const original = createSpyNotificationPayload({ code: 10002, userId: 7, userName: 'A', action: 'deleted', extra: { messageId: 1 } });
  expect(await restarted.enrich(original)).toEqual(original);
  owner = '123'; now += 86400_001;
  expect(await restarted.enrich(original)).toEqual(original);
});

it('ignores outgoing messages and deletion tombstones in history responses', () => {
  const incoming = { peer_id: 7, from_id: 7, conversation_message_id: 1, text: 'Saved' };
  expect(cachedMessagesFromResponse({ response: { items: [incoming, { ...incoming, deleted: 1 }, { ...incoming, out: 1 }, { ...incoming, from_id: 123 }, { ...incoming, peer_id: 2000000001 }] } })).toHaveLength(1);
});
