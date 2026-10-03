import { expect, it, vi } from 'vitest';
import { createWallpaperCatalog } from './wallpaperCatalog.js';

it('loads the configured photo album and keeps raw offsets for subsequent pages', async () => {
  const call = vi.fn().mockResolvedValue({ count: 300, items: [] });
  const catalog = createWallpaperCatalog(call);
  await catalog.page('photos', null, 48);
  expect(call).toHaveBeenCalledWith('photos.get', expect.objectContaining({ owner_id: -235511300, album_id: 312046957, offset: 48, rev: 1, photo_sizes: 1 }));
  await catalog.page('photos', null, 48);
  expect(call).toHaveBeenCalledTimes(1);
  catalog.refresh(); await catalog.page('photos', null, 48);
  expect(call).toHaveBeenCalledTimes(2);
});

it('resolves the video channel and loads every playlist page with original category IDs', async () => {
  const call = vi.fn(async (method: string, params: Record<string, unknown>) => {
    if (method === 'utils.resolveScreenName') return { type: 'group', object_id: 777 };
    if (method === 'video.getAlbums') return params.offset === 0
      ? { count: 3, items: [{ id: 9, title: 'Nature', count: 12 }, { id: 2, title: 'Anime', count: 25 }] }
      : { count: 3, items: [{ id: 5, title: 'Space', count: 6 }] };
    return { count: 0, items: [] };
  });
  const catalog = createWallpaperCatalog(call);
  expect((await catalog.albums()).map(album => album.id)).toEqual([9, 2, 5]);
  expect(call).toHaveBeenCalledWith('video.getAlbums', expect.objectContaining({ owner_id: -777, offset: 2, need_system: 0 }));
  await catalog.page('videos', 9, 48);
  expect(call).toHaveBeenCalledWith('video.get', { owner_id: -777, album_id: 9, count: 48, offset: 48 });
  await catalog.page('videos', null, 0);
  expect(call).toHaveBeenCalledWith('video.get', { owner_id: -777, count: 48, offset: 0 });
  expect(call.mock.calls.filter(([method]) => method === 'utils.resolveScreenName')).toHaveLength(1);
});

it('does not reuse failed requests and stops playlist pagination on an empty page', async () => {
  const call = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ count: 0, items: [] });
  const catalog = createWallpaperCatalog(call);
  await expect(catalog.page('photos', null, 0)).rejects.toThrow('offline');
  expect((await catalog.page('photos', null, 0)).items).toEqual([]);
  const emptyAlbums = createWallpaperCatalog(vi.fn(async method => method === 'utils.resolveScreenName'
    ? { type: 'group', object_id: 777 } : { count: 999, items: [] }));
  expect(await emptyAlbums.albums()).toEqual([]);
});
