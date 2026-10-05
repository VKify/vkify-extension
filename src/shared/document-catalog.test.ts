import { expect, it } from 'vitest';
import { documentPage, documentSize, documentFilename } from './document-catalog.js';

it('normalizes document tags and safe URLs while preserving raw pagination offsets', () => {
  const result = documentPage({ count: 4, items: [{ id: 1, owner_id: 2, title: 'Report', type: 1, size: 1024, date: 5, ext: 'PDF',
    access_key: 'a&b', tags: ['work', null, 3], url: 'javascript:alert(1)', preview: { photo: { sizes: [
      { width: 1000, src: 'javascript:alert(1)' }, { width: 100, src: 'https://sun9.userapi.com/small.jpg' }, { width: 800, src: 'https://sun9.userapi.com/large.jpg' },
    ] } } }, { id: 0, owner_id: 2 }] });
  expect(result.consumed).toBe(2); expect(result.count).toBe(4); expect(result.rows).toHaveLength(1);
  expect(result.rows[0]).toMatchObject({ key: '2_1', type: 1, size: 1024, date: 5000, extension: 'pdf', tags: ['work'], source: null,
    url: 'https://vk.ru/doc2_1?access_key=a%26b', preview: 'https://sun9.userapi.com/large.jpg' });
});
it('sanitizes download filenames and avoids duplicate extensions', () => {
  const doc = documentPage({ items: [{ id: 1, owner_id: 2, title: '../report?.PDF', ext: 'pdf' }] }).rows[0];
  expect(documentFilename(doc)).toBe('.._report_.PDF');
  expect(documentFilename({ ...doc, title: 'Report', extension: 'pdf' })).toBe('Report.pdf');
  expect(documentFilename({ ...doc, title: '', extension: '../../bad' })).toBe('vkify-document-2_1');
});
it('formats empty and large document sizes', () => {
  expect(documentSize(0)).toBe('0 B'); expect(documentSize(1024)).toBe('1.0 KB'); expect(documentSize(1024 ** 3)).toBe('1.0 GB');
});
