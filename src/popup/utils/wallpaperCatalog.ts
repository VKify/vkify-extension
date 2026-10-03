import { sendMessage } from '@/shared/messaging.js';
import { object, type CenterApi } from '@/shared/center-tools.js';
import { albumPage, type VideoAlbum } from '@/shared/video-catalog.js';
import { photoWallpaperPage, videoWallpaperPage, type WallpaperCatalogKind } from '@/shared/wallpaper-catalog.js';
import { PHOTO_WALLPAPERS_URL, VIDEO_WALLPAPERS_URL } from '@/popup/constants/links.js';

const PAGE_SIZE = 48;
const CACHE_TTL = 5 * 60 * 1000;

/** Reuse metadata in the popup; refresh drops it, failed requests are never cached. */
export function createWallpaperCatalog(call: CenterApi) {
  const cache = new Map<string, { expires: number; promise: Promise<unknown> }>();
  function request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const key = JSON.stringify([method, params]), existing = cache.get(key);
    if (existing && existing.expires > Date.now()) return existing.promise;
    const promise = call(method, params);
    const entry = { expires: Date.now() + CACHE_TTL, promise };
    cache.set(key, entry);
    void promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
    if (cache.size > 80) cache.delete(cache.keys().next().value!);
    return promise;
  }
  async function videoOwner(): Promise<number> {
    const screenName = new URL(VIDEO_WALLPAPERS_URL).pathname.split('/').find(part => part.startsWith('@'))?.slice(1);
    if (!screenName) throw new Error('INVALID_SOURCE');
    const resolved = object(await request('utils.resolveScreenName', { screen_name: screenName }));
    const id = Number(resolved.object_id);
    if (!Number.isSafeInteger(id) || id <= 0 || !['group', 'page', 'user'].includes(String(resolved.type))) throw new Error('INVALID_SOURCE');
    return resolved.type === 'user' ? id : -id;
  }
  return {
    refresh() { cache.clear(); },
    async albums(): Promise<VideoAlbum[]> {
      const owner = await videoOwner();
      const albums = new Map<number, VideoAlbum>();
      for (let offset = 0; ; ) {
        const page = albumPage(await request('video.getAlbums', { owner_id: owner, extended: 1, need_system: 0, count: 100, offset }));
        page.rows.filter(album => album.id > 0).forEach(album => albums.set(album.id, album));
        offset += page.consumed;
        if (!page.consumed || offset >= page.count) break;
      }
      return [...albums.values()];
    },
    async page(kind: WallpaperCatalogKind, album: number | null, offset: number) {
      if (kind === 'photos') {
        const source = new URL(PHOTO_WALLPAPERS_URL).pathname.match(/^\/album(-?\d+)_(\d+)$/);
        if (!source) throw new Error('INVALID_SOURCE');
        return photoWallpaperPage(await request('photos.get', { owner_id: Number(source[1]), album_id: Number(source[2]),
          count: PAGE_SIZE, offset, photo_sizes: 1, rev: 1 }));
      }
      return videoWallpaperPage(await request('video.get', { owner_id: await videoOwner(), count: PAGE_SIZE, offset,
        ...(album === null ? {} : { album_id: album }) }));
    },
  };
}

export const wallpaperCatalog = createWallpaperCatalog(async (method, params) => {
  const response = await sendMessage({ type: 'VK_API_CALL', method, params });
  if (!response?.success || response.data == null) throw new Error(response?.error || 'API_UNAVAILABLE');
  return response.data;
});
