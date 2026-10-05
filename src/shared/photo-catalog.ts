import { object, safeUrl } from './center-tools.js';

export interface CatalogPhoto {
  key: string; title: string; preview: string | null; source: string | null; url: string;
  date: number; width: number; height: number; albumId: number;
}
export interface PhotoAlbum { id: number; title: string; count: number; canUpload: boolean }

export function photoPage(raw: unknown) {
  const page = object(raw);
  if (!Array.isArray(page.items)) throw new Error('INVALID_RESPONSE');
  const rows: CatalogPhoto[] = page.items.flatMap(rawPhoto => {
    const p = object(rawPhoto), owner = Number(p.owner_id), id = Number(p.id);
    if (!Number.isSafeInteger(owner) || !owner || !Number.isSafeInteger(id) || id <= 0) return [];
    const sizes = (Array.isArray(p.sizes) ? p.sizes : []).map(object).filter(s => safeUrl(s.url))
      .sort((a, b) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0));
    const image = sizes[0];
    return [{ key: `${owner}_${id}`, title: String(p.text || ''), preview: safeUrl(image?.url), source: safeUrl(image?.url),
      url: `https://vk.ru/photo${owner}_${id}${typeof p.access_key === 'string' && p.access_key ? '?access_key=' + encodeURIComponent(p.access_key) : ''}`,
      date: Math.max(0, Number(p.date) || 0) * 1000, width: Number(image?.width) || 0, height: Number(image?.height) || 0,
      albumId: Number(p.album_id) || 0 }];
  });
  return { rows, consumed: page.items.length, count: Math.max(page.items.length, Number(page.count) || 0) };
}
export function photoAlbumPage(raw: unknown) {
  const page = object(raw);
  if (!Array.isArray(page.items)) throw new Error('INVALID_RESPONSE');
  const rows: PhotoAlbum[] = page.items.flatMap(rawAlbum => {
    const a = object(rawAlbum), id = Number(a.id);
    return Number.isSafeInteger(id) ? [{ id, title: String(a.title || ''), count: Math.max(0, Number(a.size) || 0),
      canUpload: id > 0 && a.can_upload !== 0 && a.can_upload !== false }] : [];
  });
  return { rows, consumed: page.items.length, count: Math.max(page.items.length, Number(page.count) || 0) };
}
