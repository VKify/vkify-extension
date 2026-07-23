import { describe, expect, it } from 'vitest';
import { PAGE_SIZE } from './constants.js';
import { buildHistoryParams } from './history.js';

describe('buildHistoryParams', () => {
  it('keeps regular /im history requests unchanged', () => {
    expect(buildHistoryParams({ peerId: 42, groupId: null }, 200)).toEqual({
      peer_id: 42,
      count: PAGE_SIZE,
      offset: 200,
      extended: 1,
    });
  });

  it('adds group_id for a /gim community inbox', () => {
    expect(buildHistoryParams({ peerId: 13750429, groupId: 235511300 }, 0)).toEqual({
      peer_id: 13750429,
      group_id: 235511300,
      count: PAGE_SIZE,
      offset: 0,
      extended: 1,
    });
  });
});
