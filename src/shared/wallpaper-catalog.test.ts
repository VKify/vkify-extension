import { describe, expect, it } from 'vitest';
import { filterWallpapers, photoWallpaperPage, videoWallpaperPage, wallpaperTags, wallpaperTagCategories } from './wallpaper-catalog.js';

describe('wallpaper catalog normalization', () => {
  it('uses the full photo for application, a smaller preview, and advances past invalid rows', () => {
    const page = photoWallpaperPage({ count: 10, items: [
      { owner_id: -10, id: 7, text: ' Landscape ', date: 100,
        orig_photo: { width: 1280, height: 720, url: 'https://cdn.example/older-original.jpg' }, sizes: [
        { width: 100, height: 100, url: 'https://cdn.example/tiny.jpg' },
        { width: 480, height: 270, url: 'https://cdn.example/preview.jpg' },
        { width: 1920, height: 1080, url: 'https://cdn.example/full.jpg' },
        { width: 4000, height: 4000, url: 'javascript:bad()' },
      ] },
      { owner_id: -10, id: 8, sizes: [{ url: 'data:image/png;base64,AAAA' }] },
      { owner_id: 0, id: 9, sizes: [{ url: 'https://cdn.example/photo' }] },
    ] });
    expect(page).toMatchObject({ consumed: 3, total: 10 });
    expect(page.items).toEqual([{ id: 'vk-photo--10_7', name: 'Landscape', date: 100000,
      preview: 'https://cdn.example/preview.jpg', url: 'https://cdn.example/full.jpg', type: 'image', tags: [] }]);
  });

  it('keeps VK embed hashes and excludes restricted videos without losing pagination offsets', () => {
    const page = videoWallpaperPage({ count: 20, items: [
      { owner_id: -10, id: 1, title: 'Sea', date: 30, player: 'https://vkvideo.ru/video_ext.php?oid=-10&id=1&hash=private',
        files: { mp4_1080: 'https://cdn.example/expired.mp4' }, image: [{ width: 480, url: 'https://cdn.example/poster' }] },
      { owner_id: -10, id: 2, title: 'Unavailable', can_view: 0 },
      { owner_id: -10, id: 3, title: 'Forest', player: 'javascript:bad()' },
    ] });
    expect(page.consumed).toBe(3); expect(page.total).toBe(20);
    expect(page.items.map(item => item.id)).toEqual(['vk-video--10_1', 'vk-video--10_3']);
    expect(page.items[0].url).toContain('hash=private');
    expect(page.items[0].url).toContain('mute=1&loop=1');
    expect(page.items[1].url).toContain('oid=-10&id=3');
    expect(page.items.every(item => item.type === 'embed')).toBe(true);
  });

  it('rejects malformed pages rather than presenting an empty album', () => {
    expect(() => photoWallpaperPage({ error: 'denied' })).toThrow('INVALID_RESPONSE');
    expect(() => videoWallpaperPage(null)).toThrow('INVALID_RESPONSE');
  });

  it('extracts multiple unique tags, including Cyrillic, without treating fragments as tags', () => {
    expect(wallpaperTags('Scene #Film #Games, #film\n#Природа #Sci_Fi https://example.com/page#anchor'))
      .toEqual(['Film', 'Games', 'Природа', 'Sci_Fi']);
    expect(wallpaperTags('No categories')).toEqual([]);
  });

  it('counts photos in every tagged category and combines the category with search and ordering', () => {
    const items = photoWallpaperPage({ count: 3, items: [
      { owner_id: -1, id: 1, text: 'City #Film #Games #Film', date: 10, sizes: [{ url: 'https://cdn.example/a' }] },
      { owner_id: -1, id: 2, text: 'Forest #games', date: 20, sizes: [{ url: 'https://cdn.example/b' }] },
      { owner_id: -1, id: 3, text: 'Sea', date: 30, sizes: [{ url: 'https://cdn.example/c' }] },
    ] }).items;
    expect(wallpaperTagCategories(items, 'en')).toEqual([
      { id: 'film', title: 'Film', count: 1 }, { id: 'games', title: 'Games', count: 2 },
    ]);
    expect(filterWallpapers(items, '', 'newest', 'en', 'Games').map(item => item.id)).toEqual(['vk-photo--1_2', 'vk-photo--1_1']);
    expect(filterWallpapers(items, 'city', 'oldest', 'en', 'games').map(item => item.id)).toEqual(['vk-photo--1_1']);
    expect(filterWallpapers(items, '', 'title', 'en', 'film').map(item => item.id)).toEqual(['vk-photo--1_1']);
    expect(filterWallpapers(items, '', 'newest', 'en', 'unknown')).toEqual([]);
    expect(filterWallpapers(items, '', 'newest', 'en')).toHaveLength(3);
  });

  it('searches and sorts without changing the original collection', () => {
    const items = photoWallpaperPage({ count: 2, items: [
      { owner_id: -1, id: 1, text: 'Море', date: 10, sizes: [{ url: 'https://cdn.example/a' }] },
      { owner_id: -1, id: 2, text: 'Лес', date: 20, sizes: [{ url: 'https://cdn.example/b' }] },
    ] }).items;
    expect(filterWallpapers(items, '  МОРЕ ', 'newest', 'ru').map(item => item.name)).toEqual(['Море']);
    expect(filterWallpapers(items, '', 'newest', 'ru').map(item => item.name)).toEqual(['Лес', 'Море']);
    expect(filterWallpapers(items, '', 'oldest', 'ru').map(item => item.name)).toEqual(['Море', 'Лес']);
    expect(filterWallpapers(items, '', 'title', 'ru').map(item => item.name)).toEqual(['Лес', 'Море']);
    expect(items.map(item => item.name)).toEqual(['Море', 'Лес']);
  });
});
