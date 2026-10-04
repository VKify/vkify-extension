import { object, safeUrl } from './center-tools.js';
import { videoPage } from './video-catalog.js';
import { parseVideoUrl } from './videoEmbed.js';

export type WallpaperCatalogKind = 'photos' | 'videos';
export type WallpaperCatalogSort = 'newest' | 'oldest' | 'title';
export interface CatalogWallpaper {
  id: string;
  name: string;
  preview: string;
  url: string;
  type: 'image' | 'embed';
  date: number;
  tags?: string[];
}
export interface WallpaperCatalogPage {
  items: CatalogWallpaper[];
  consumed: number;
  total: number;
}
export type WallpaperSelection = Omit<CatalogWallpaper, 'date'> & { preserveOriginal?: boolean };

/** VK descriptions can assign a photo to several categories. */
export function wallpaperTags(description: string): string[] {
  const tags = new Map<string, string>();
  for (const match of description.matchAll(/(?:^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu)) {
    const tag = match[1];
    if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
  }
  return [...tags.values()];
}

export function wallpaperTagCategories(items: CatalogWallpaper[], locale: string): { id: string; title: string; count: number }[] {
  const categories = new Map<string, { id: string; title: string; count: number }>();
  for (const item of items) {
    const seen = new Set<string>();
    for (const title of item.tags ?? []) {
      const id = title.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      const category = categories.get(id);
      if (category) category.count++;
      else categories.set(id, { id, title, count: 1 });
    }
  }
  return [...categories.values()].sort((a, b) => a.title.localeCompare(b.title, locale));
}

function photoImages(raw: unknown): { url: string; area: number }[] {
  return (Array.isArray(raw) ? raw : []).flatMap(value => {
    const image = object(value), url = safeUrl(image.url);
    return url ? [{ url, area: Math.max(0, Number(image.width) || 0) * Math.max(0, Number(image.height) || 0) }] : [];
  }).sort((a, b) => a.area - b.area);
}

export function photoWallpaperPage(raw: unknown): WallpaperCatalogPage {
  const page = object(raw);
  if (!Array.isArray(page.items)) throw new Error('INVALID_RESPONSE');
  const items = page.items.flatMap(value => {
    const photo = object(value), owner = Number(photo.owner_id), id = Number(photo.id);
    if (!Number.isSafeInteger(owner) || !owner || !Number.isSafeInteger(id) || id <= 0) return [];
    const images = photoImages([...(Array.isArray(photo.sizes) ? photo.sizes : []), photo.orig_photo]);
    const url = images[images.length - 1]?.url;
    if (!url) return [];
    const preview = images.find(image => image.area >= 400 * 225)?.url ?? url;
    return [{ id: `vk-photo-${owner}_${id}`, name: typeof photo.text === 'string' ? photo.text.trim() : '',
      preview, url, type: 'image' as const, date: Math.max(0, Number(photo.date) || 0) * 1000,
      tags: wallpaperTags(typeof photo.text === 'string' ? photo.text : '') }];
  });
  return { items, consumed: page.items.length, total: Math.max(page.items.length, Number(page.count) || 0) };
}

export function videoWallpaperPage(raw: unknown): WallpaperCatalogPage {
  const page = videoPage(raw);
  const rawItems = (object(raw).items as unknown[]).map(object);
  const players = new Map(rawItems.map(video => [`${video.owner_id}_${video.id}`, video.player]));
  const items = page.rows.flatMap(video => {
    if (video.unavailable) return [];
    const player = players.get(video.key);
    const parsed = typeof player === 'string' ? parseVideoUrl(player) : null;
    // Keep the VK player's hash, and avoid persisting CDN links that expire.
    const embed = parsed?.platform === 'vk' ? parsed : parseVideoUrl(video.url);
    if (!embed) return [];
    return [{ id: `vk-video-${video.key}`, name: video.title, preview: video.preview ?? '',
      url: embed.embedUrl, type: 'embed' as const, date: video.date }];
  });
  return { items, consumed: page.consumed, total: page.count };
}

/** Search and sorting apply to loaded items, within the chosen VK playlist. */
export function filterWallpapers(items: CatalogWallpaper[], query: string, sort: WallpaperCatalogSort, locale: string, tag = ''): CatalogWallpaper[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  return items.filter(item => (!tag || item.tags?.some(value => value.toLowerCase() === tag.toLowerCase()))
    && (!needle || item.name.toLocaleLowerCase(locale).includes(needle))).sort((a, b) => {
    if (sort === 'title') return a.name.localeCompare(b.name, locale) || a.id.localeCompare(b.id);
    return (sort === 'oldest' ? a.date - b.date : b.date - a.date) || a.id.localeCompare(b.id);
  });
}
