import { describe, expect, it } from 'vitest';
import { PAGE_SIZE } from './constants.js';
import { buildConversationParams, buildHistoryParams, filterSelectedMessages } from './history.js';

describe('buildHistoryParams', () => {
  it('keeps regular /im history requests unchanged', () => {
    expect(buildHistoryParams({ peerId: 42, groupId: null }, 200)).toEqual({
      peer_id: 42,
      count: PAGE_SIZE,
      offset: 200,
      extended: 1,
      fields: 'photo_100',
    });
  });

  it('adds group_id for a /gim community inbox', () => {
    expect(buildHistoryParams({ peerId: 13750429, groupId: 235511300 }, 0)).toEqual({
      peer_id: 13750429,
      group_id: 235511300,
      count: PAGE_SIZE,
      offset: 0,
      extended: 1,
      fields: 'photo_100',
    });
  });
});

describe('buildConversationParams', () => {
  it('keeps the community context for read-receipt metadata', () => {
    expect(buildConversationParams({ peerId: 77, groupId: 123 })).toEqual({
      peer_ids: 77,
      group_id: 123,
      extended: 0,
    });
  });
});

describe('filterSelectedMessages', () => {
  const messages = [
    { id: 1001, conversation_message_id: 11 },
    { id: 1002, conversation_message_id: 12 },
    { id: 1003, conversation_message_id: 13 },
  ];

  it('matches selected DOM cmids and preserves chronological order', () => {
    expect(filterSelectedMessages(messages, new Set([13, 11]))).toEqual([
      messages[0],
      messages[2],
    ]);
  });

  it('falls back to the global message id used by legacy markup', () => {
    expect(filterSelectedMessages(messages, new Set([1002]))).toEqual([messages[1]]);
  });
});
