import { describe, expect, it } from 'vitest';
import { dialogPage, filePage, groupPage, mergeRows, peerUrl, safeUrl, wallActivity } from './center-tools.js';
describe('Center API views', () => {
  it('resolves user, community and chat titles from extended conversations', () => {
    const page = dialogPage({ count: 4, profiles: [{ id: 1, first_name: 'A', last_name: 'B' }], groups: [{ id: 2, name: 'Group' }], items: [
      { conversation: { peer: { id: 1 } } }, { conversation: { peer: { id: -2 } } },
      { conversation: { peer: { id: 2000000001 }, chat_settings: { title: 'Chat' } } }, { conversation: { peer: { id: NaN } } },
    ] });
    expect(page.rows.map(row => row.title)).toEqual(['A B', 'Group', 'Chat']); expect(page.consumed).toBe(4);
    expect(peerUrl(2000000001, 42)).toBe('https://vk.ru/im?sel=c1&cmid=42');
  });
  it('uses the attachment cursor and only safe links/previews', () => {
    const page = filePage({ next_from: 'cursor', items: [{ cmid: 42, message_id: 9, position: 1, date: 100, attachment: { type: 'photo', photo: { id: 5, owner_id: 1, sizes: [{ width: 10, url: 'https://cdn.example/small' }, { width: 100, url: 'https://cdn.example/large' }] } } }] }, 'photo');
    expect(page.next).toBe('cursor'); expect(page.rows[0]).toMatchObject({ cmid: 42, preview: 'https://cdn.example/large', url: 'https://cdn.example/large' });
    expect(safeUrl('javascript:alert(1)')).toBeNull(); expect(safeUrl('data:text/html,x')).toBeNull();
    expect(mergeRows(page.rows, page.rows, row => row.key)).toHaveLength(1);
  });
  it('does not conflate deactivation, private walls and missing data with inactivity', () => {
    const rows = groupPage({ count: 2, items: [{ id: 1, name: 'Private', is_closed: 1 }, { id: 2, deactivated: 'deleted' }] }).rows;
    expect(rows[0]).toMatchObject({ closed: true, activity: 'unchecked' }); expect(rows[1]?.activity).toBe('unavailable');
    expect(wallActivity({ count: 0, items: [] }, 90).activity).toBe('empty');
    expect(wallActivity({ count: 2, items: [] }, 90).activity).toBe('error');
    expect(() => wallActivity(null, 90)).toThrow('INVALID_RESPONSE');
  });
  it('ignores an old pinned post when a newer owner post exists', () => {
    const now = 2000000000000;
    const recent = now / 1000 - 86400;
    expect(wallActivity({ count: 2, items: [{ date: 1, is_pinned: 1 }, { date: recent }] }, 90, now)).toEqual({ activity: 'active', lastPost: recent * 1000 });
    expect(wallActivity({ count: 1, items: [{ date: now / 1000 - 86400 * 100 }] }, 90, now).activity).toBe('inactive');
  });
});
