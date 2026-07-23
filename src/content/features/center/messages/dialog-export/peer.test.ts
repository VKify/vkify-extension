// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { CHAT_PEER_OFFSET } from './constants.js';
import { parseConversationContext } from './peer.js';

describe('parseConversationContext', () => {
  it('parses a regular Messenger Engine dialog', () => {
    expect(parseConversationContext(new URL('https://vk.ru/im/convo/12345'))).toEqual({
      peerId: 12345,
      groupId: null,
    });
  });

  it('parses legacy direct and chat dialogs', () => {
    expect(parseConversationContext(new URL('https://vk.ru/im?sel=-42'))).toEqual({
      peerId: -42,
      groupId: null,
    });
    expect(parseConversationContext(new URL('https://vk.ru/im?sel=c77'))).toEqual({
      peerId: CHAT_PEER_OFFSET + 77,
      groupId: null,
    });
  });

  it('parses a community inbox dialog with its group context', () => {
    expect(parseConversationContext(
      new URL('https://vk.ru/gim235511300/convo/13750429?entrypoint=list_all'),
    )).toEqual({
      peerId: 13750429,
      groupId: 235511300,
    });
  });

  it('does not treat a gim list page as an opened conversation', () => {
    expect(parseConversationContext(new URL('https://vk.ru/gim235511300'))).toBeNull();
  });

  it('keeps the community context when VK puts peer in the query', () => {
    expect(parseConversationContext(
      new URL('https://vk.ru/gim235511300?peer=13750429'),
    )).toEqual({
      peerId: 13750429,
      groupId: 235511300,
    });
  });
});
