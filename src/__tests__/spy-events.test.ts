import { describe, it, expect } from 'vitest';
import {
  parseEvent,
  cachableMessage,
  peerToUser,
  LONGPOLL_URL_RE,
  MSG_FLAG_DELETED_FOR_ALL,
  CHAT_PEER_THRESHOLD,
} from '../content/injected/spy-events.js';

const DELETED = MSG_FLAG_DELETED_FOR_ALL; // 131072
const CHAT = CHAT_PEER_THRESHOLD;         // 2_000_000_000

describe('LONGPOLL_URL_RE', () => {
  it('matches the real new-messenger long-poll endpoint (gim<server>)', () => {
    // Реальный захваченный URL — регресс-страж после бага ruim→gim.
    expect(LONGPOLL_URL_RE.test('https://api.vk.ru/gim822543105?version=21&mode=682')).toBe(true);
  });

  it('matches the legacy ruim endpoint', () => {
    expect(LONGPOLL_URL_RE.test('https://api.vk.ru/ruim123?act=a_check')).toBe(true);
  });

  it('does not match ordinary method calls', () => {
    expect(LONGPOLL_URL_RE.test('https://api.vk.ru/method/users.get?v=5.131')).toBe(false);
    expect(LONGPOLL_URL_RE.test('https://api.vk.ru/method/messages.send')).toBe(false);
  });
});

describe('parseEvent — status events (typing/voice/uploads)', () => {
  it('parses typing with the new user-list structure', () => {
    // [63, peerId, [userIds], totalCount, ts] — формат, снятый с живого VK.
    expect(parseEvent([63, 664425024, [664425024], 1, 1780051489])).toEqual({
      code: 63,
      userId: 664425024,
      action: 'печатает сообщение',
      extra: { peerId: 664425024 },
    });
  });

  it('falls back to update[1] when there is no user list', () => {
    expect(parseEvent([64, 555])).toMatchObject({ code: 64, userId: 555, action: 'записывает голосовое' });
  });

  it('labels photo/video/file uploads', () => {
    expect(parseEvent([65, 1, [1]])?.action).toBe('загружает фото');
    expect(parseEvent([66, 1, [1]])?.action).toBe('загружает видео');
    expect(parseEvent([67, 1, [1]])?.action).toBe('загружает файл');
  });
});

describe('parseEvent — invisibility (81)', () => {
  it('normalizes the negative user id and reads the state', () => {
    expect(parseEvent([81, -123, 1, 1700000000])).toMatchObject({
      userId: 123,
      action: 'включил невидимку',
    });
    expect(parseEvent([81, -123, 0, 1700000000])?.action).toBe('выключил невидимку');
  });
});

describe('parseEvent — friends (90)', () => {
  it('maps known action types', () => {
    expect(parseEvent([90, 2, 456])?.action).toBe('вы приняли его заявку в друзья');
    expect(parseEvent([90, 3, 456])?.action).toBe('вы удалили его из друзей');
  });

  it('keeps unknown action types with a generic label', () => {
    expect(parseEvent([90, 7, 456])?.action).toBe('действие с друзьями (7)');
  });
});

describe('parseEvent — chat events (52)', () => {
  it('parses sub-types that carry a user id', () => {
    expect(parseEvent([52, 6, CHAT + 5, 789])).toMatchObject({
      userId: 789,
      action: 'вступил в беседу',
      extra: { updateType: 6, peerId: CHAT + 5 },
    });
  });

  it('ignores sub-types without an attributable user (e.g. rename)', () => {
    expect(parseEvent([52, 1, CHAT + 5, 'New name'])).toBeNull();
  });
});

describe('parseEvent — calls (115)', () => {
  it('reads the caller from the call payload', () => {
    expect(parseEvent([115, { user_id: 111 }])).toMatchObject({ userId: 111, action: 'звонит вам' });
  });
});

describe('parseEvent — message flags / delete (10002)', () => {
  it('reports delete-for-all in a direct chat and exposes messageId', () => {
    expect(parseEvent([10002, 9001, DELETED, 333])).toMatchObject({
      code: 10002,
      userId: 333,
      action: 'удалил сообщение для всех',
      extra: { messageId: 9001, peerId: 333 },
    });
  });

  it('ignores flag changes that are not delete-for-all', () => {
    expect(parseEvent([10002, 9001, 1, 333])).toBeNull();
  });

  it('ignores deletes in group chats (no attributable sender)', () => {
    expect(parseEvent([10002, 9001, DELETED, CHAT + 10])).toBeNull();
  });
});

describe('parseEvent — incoming message (10004)', () => {
  it('reads sender, peer and truncates text to 100 chars', () => {
    const longText = 'x'.repeat(150);
    const parsed = parseEvent([10004, 1, 0, 0, 222, 555, longText]);
    expect(parsed).toMatchObject({ userId: 222, action: 'отправил сообщение', extra: { peerId: 555 } });
    expect((parsed?.extra.text as string).length).toBe(100);
  });

  it('ignores outgoing messages (flag bit 2)', () => {
    expect(parseEvent([10004, 1, 2, 0, 222, 555, 'hi'])).toBeNull();
  });
});

describe('parseEvent — read receipts (10007) and clear (10013)', () => {
  it('attributes a read receipt to the direct peer', () => {
    expect(parseEvent([10007, 444, 9999, 1])).toMatchObject({ userId: 444, action: 'прочитал сообщение' });
  });

  it('ignores read receipts from group chats', () => {
    expect(parseEvent([10007, CHAT + 1, 9999, 1])).toBeNull();
  });

  it('parses conversation clear', () => {
    expect(parseEvent([10013, 444, 9999])?.action).toBe('очистил всю переписку');
  });
});

describe('parseEvent — guards', () => {
  it('returns null for unknown codes, empty and non-arrays', () => {
    expect(parseEvent([99999, 1])).toBeNull();
    expect(parseEvent([])).toBeNull();
    expect(parseEvent('nope' as unknown as unknown[])).toBeNull();
  });

  it('rejects events that resolve to a non-positive user id', () => {
    expect(parseEvent([10004, 1, 0, 0, 0, 555, 'hi'])).toBeNull();
  });
});

describe('peerToUser', () => {
  it('passes through direct peers', () => {
    expect(peerToUser(123)).toBe(123);
  });
  it('rejects group-chat peers and invalid ids', () => {
    expect(peerToUser(CHAT)).toBeNull();
    expect(peerToUser(0)).toBeNull();
    expect(peerToUser(null)).toBeNull();
  });
});

describe('cachableMessage', () => {
  it('extracts id + text from an incoming message', () => {
    expect(cachableMessage([10004, 42, 0, 0, 222, 555, 'hello'])).toEqual({ id: 42, text: 'hello' });
  });
  it('returns null for empty text or non-message updates', () => {
    expect(cachableMessage([10004, 42, 0, 0, 222, 555, ''])).toBeNull();
    expect(cachableMessage([10005, 42, 0, 1])).toBeNull();
    expect(cachableMessage([63, 1, [1]])).toBeNull();
  });
});
