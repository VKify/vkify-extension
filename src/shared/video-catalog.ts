import { object, safeUrl } from './center-tools.js';

export interface CatalogVideo {
  key: string; title: string; description: string; preview: string | null; url: string;
  duration: number; date: number; views: number | null;
  unavailable: boolean; restriction: string;
}
export interface VideoAlbum { id: number; title: string; count: number }

function items(raw: unknown) {
  const page = object(raw);
  if (!Array.isArray(page.items)) throw new Error('INVALID_RESPONSE');
  return { page, rows: page.items.map(object) };
}
export function videoPage(raw: unknown) {
  const { page, rows } = items(raw);
  const videos: CatalogVideo[] = rows.flatMap(v => {
    const owner = Number(v.owner_id), id = Number(v.id);
    if (!Number.isSafeInteger(owner) || !owner || !Number.isSafeInteger(id) || id <= 0) return [];
    const images = (Array.isArray(v.image) ? v.image : []).map(object)
      .filter(i => safeUrl(i.url)).sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
    return [{ key: `${owner}_${id}`, title: String(v.title || ''), description: String(v.description || ''),
      preview: safeUrl(images[0]?.url),
      url: `https://vk.ru/video${owner}_${id}${typeof v.access_key === 'string' && v.access_key ? '?access_key=' + encodeURIComponent(v.access_key) : ''}`,
      duration: Math.max(0, Number(v.duration) || 0), date: Math.max(0, Number(v.date) || 0) * 1000,
      views: typeof v.views === 'number' && v.views >= 0 ? v.views : null,
      unavailable: Number(v.content_restricted) > 0 || v.can_view === 0 || v.can_view === false,
      restriction: typeof v.content_restricted_message === 'string' ? v.content_restricted_message : '',
    }];
  });
  return { rows: videos, consumed: rows.length, count: Math.max(rows.length, Number(page.count) || 0) };
}
export function albumPage(raw: unknown) {
  const { page, rows } = items(raw);
  const albums: VideoAlbum[] = rows.flatMap(a => {
    const id = Number(a.id);
    return Number.isSafeInteger(id) ? [{ id, title: String(a.title || ''), count: Math.max(0, Number(a.count) || 0) }] : [];
  });
  return { rows: albums, consumed: rows.length, count: Math.max(rows.length, Number(page.count) || 0) };
}
export function videoDuration(seconds: number): string {
  const n = Math.floor(Math.max(0, seconds));
  const parts = [Math.floor(n / 60), n % 60];
  if (n >= 3600) return `${Math.floor(n / 3600)}:${String(parts[0] % 60).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
  return `${parts[0]}:${String(parts[1]).padStart(2, '0')}`;
}
