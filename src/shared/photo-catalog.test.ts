import { expect, it } from 'vitest';
import { photoAlbumPage, photoPage } from './photo-catalog.js';
it('keeps pagination offsets for invalid rows and chooses the largest safe image', () => {
  const page = photoPage({ count: 3, items: [{ id: 1, owner_id: 2, album_id: -15, text: 'Caption', date: 5, access_key: 'a&b', sizes: [
    { width: 1000, height: 1000, url: 'javascript:alert(1)' }, { width: 100, height: 100, url: 'https://sun9.userapi.com/small.jpg' },
    { width: 800, height: 600, url: 'https://sun9.userapi.com/full.jpg' },
  ] }, { id: 0, owner_id: 2 }] });
  expect(page.consumed).toBe(2); expect(page.rows).toHaveLength(1);
  expect(page.rows[0]).toMatchObject({ key: '2_1', title: 'Caption', date: 5000, albumId: -15, source: 'https://sun9.userapi.com/full.jpg', url: 'https://vk.ru/photo2_1?access_key=a%26b' });
});
it('uses photo album sizes and excludes system/read-only albums from uploading', () => {
  expect(photoAlbumPage({ items: [{ id: -15, size: 9 }, { id: 4, size: 5, can_upload: 0 }, { id: 5, size: 3, can_upload: 1 }] }).rows)
    .toEqual([{ id: -15, title: '', count: 9, canUpload: false }, { id: 4, title: '', count: 5, canUpload: false }, { id: 5, title: '', count: 3, canUpload: true }]);
});
