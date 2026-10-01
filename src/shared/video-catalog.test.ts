import { expect, it } from 'vitest';
import { albumPage, videoPage, videoDuration } from './video-catalog.js';
it('keeps owner-qualified video keys, safe previews and private access keys', () => {
  const result = videoPage({ count: 8, items: [
    { id: 1, owner_id: 1, title: 'One', access_key: 'a&b', image: [{ width: 1000, url: 'javascript:bad()' }, { width: 100, url: 'https://cdn.example/small' }, { width: 600, url: 'https://cdn.example/large' }], duration: 3661 },
    { id: 1, owner_id: -2, content_restricted: 1, content_restricted_message: 'Removed' },
    { id: 2, owner_id: 1, is_private: 1, can_view: 1 }, { id: 0, owner_id: 1 },
  ] });
  expect(result.consumed).toBe(4); expect(result.count).toBe(8);
  expect(result.rows.map(v => v.key)).toEqual(['1_1', '-2_1', '1_2']);
  expect(result.rows[0]?.preview).toBe('https://cdn.example/large');
  expect(result.rows[0]?.url).toBe('https://vk.ru/video1_1?access_key=a%26b');
  expect(result.rows[1]?.unavailable).toBe(true); expect(result.rows[2]?.unavailable).toBe(false);
});
it('does not turn malformed API data into an empty successful catalog', () => {
  expect(() => videoPage({ error: 'Denied' })).toThrow('INVALID_RESPONSE');
  expect(() => albumPage(null)).toThrow('INVALID_RESPONSE');
  expect(albumPage({ count: 2, items: [{ id: -1, title: 'System' }, { id: 3, count: 8 }] }).rows).toHaveLength(2);
});
it('formats minutes and hours without confusing duration with a date', () => {
  expect(videoDuration(59)).toBe('0:59'); expect(videoDuration(600)).toBe('10:00');
  expect(videoDuration(3661)).toBe('1:01:01');
});
