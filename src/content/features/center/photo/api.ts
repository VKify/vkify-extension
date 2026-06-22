/**
 * Доступ к VK photos API и разбор страницы: ID текущего фото, путь альбома,
 * постраничная выгрузка альбома и скачивание байтов фото.
 */

import { vkApi } from '@/content/api/vk-api-client.js';
import type { PhotoItem, PhotoSize, PhotosGetResponse } from './types.js';

export const PHOTOS_GET_LIMIT = 1000; // максимум VK API photos.get

export function isVkHost(): boolean {
  const host = window.location.hostname;
  return host === 'vk.com' || host === 'vk.ru';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** `/album<owner>_<id>` — id может быть числом или placeholder'ом `0`/`000`. */
export function parseAlbumPath(pathname: string): { ownerId: number; albumId: string } | null {
  const m = pathname.match(/^\/album(-?\d+)_(\w+)$/);
  if (!m) return null;
  return { ownerId: Number(m[1]), albumId: m[2] };
}

/** Photo-id из `.like_wrap._like_photo<owner>_<id>` или data-options фолбэка. */
export function findCurrentPhotoId(): { ownerId: number; photoId: number } | null {
  const likeWrap = document.querySelector<HTMLElement>(
    '#pv_box .like_wrap, #pv_box [class*="_like_photo"]',
  );
  if (likeWrap) {
    for (const cls of Array.from(likeWrap.classList)) {
      const m = cls.match(/^_like_photo(-?\d+)_(\d+)$/);
      if (m) return { ownerId: Number(m[1]), photoId: Number(m[2]) };
    }
  }
  const dataAlt = document.querySelector<HTMLElement>(
    '#pv_box [data-task-click="Page/owner_set_exist_photo"]',
  );
  const opt = dataAlt?.getAttribute('data-options');
  if (opt) {
    const m = opt.match(/"photo":"(-?\d+)_(\d+)"/);
    if (m) return { ownerId: Number(m[1]), photoId: Number(m[2]) };
  }
  return null;
}

export function getBestPhotoUrl(sizes: PhotoSize[]): string | null {
  if (!sizes.length) return null;
  return [...sizes].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url;
}

export async function fetchPhoto(ownerId: number, photoId: number): Promise<PhotoItem | null> {
  try {
    // photo_sizes=1 — массив `sizes` вместо legacy полей photo_75/130/…
    // photos.getById возвращает массив фото напрямую, а не {count, items}.
    const resp = await vkApi.call('photos.getById', {
      photos:      `${ownerId}_${photoId}`,
      extended:    0,
      photo_sizes: 1,
    }) as PhotoItem[] | { items?: PhotoItem[] };

    const item = Array.isArray(resp) ? resp[0] : resp?.items?.[0];
    if (!item) console.warn('[VKify] photos.getById — пустой ответ:', resp);
    return item ?? null;
  } catch (err) {
    console.error('[VKify] photos.getById failed:', err);
    return null;
  }
}

async function fetchAlbumPage(
  ownerId: number,
  albumId: string | number,
  offset: number,
): Promise<PhotosGetResponse | null> {
  try {
    return await vkApi.call('photos.get', {
      owner_id:    ownerId,
      album_id:    albumId,
      offset,
      count:       PHOTOS_GET_LIMIT,
      rev:         0,
      photo_sizes: 1,
    }) as PhotosGetResponse;
  } catch (err) {
    console.warn(`[VKify] photos.get(album_id=${albumId}) failed:`, err);
    return null;
  }
}

/**
 * VK URL содержит album_id как число или placeholder `0`/`000` для системных
 * альбомов — API же ждёт строки `wall` / `profile` / `saved`. Для сообществ
 * (ownerId<0) placeholder обычно = wall, для пользователей = saved.
 */
function albumIdCandidates(raw: string, ownerId: number): (string | number)[] {
  const n = Number(raw);
  if (Number.isFinite(n) && /^-?\d+$/.test(raw) && n > 0) return [n];
  if (/^0+$/.test(raw)) {
    return ownerId < 0
      ? ['wall', 'profile', 'saved', 0]
      : ['saved', 'wall', 'profile', 0];
  }
  return [raw];
}

/**
 * Все фото альбома постранично, с retry и rate-limit паузами.
 *
 *   • Для каждой страницы 1 retry с задержкой 600ms.
 *   • 350ms между страницами под VK rate-limit (~3 req/s на токен).
 *   • Терпим до 3 пустых подряд если что-то уже получили.
 *   • Лимит 200 страниц = 200k фото.
 */
export async function fetchAlbumPhotos(ownerId: number, albumId: string): Promise<PhotoItem[]> {
  for (const candidate of albumIdCandidates(albumId, ownerId)) {
    const all: PhotoItem[] = [];
    let offset = 0;
    let success = false;
    let consecutiveFailures = 0;

    for (let i = 0; i < 200; i++) {
      let resp = await fetchAlbumPage(ownerId, candidate, offset);
      if (!resp) {
        await sleep(600);
        resp = await fetchAlbumPage(ownerId, candidate, offset);
      }
      if (!resp?.items?.length) {
        if (success && ++consecutiveFailures < 3) { await sleep(1000); continue; }
        break;
      }
      consecutiveFailures = 0;
      success = true;
      all.push(...resp.items);
      if (all.length >= resp.count) break;
      if (resp.items.length < PHOTOS_GET_LIMIT) break;
      offset = all.length;
      await sleep(350);
    }

    if (success && all.length > 0) return all;
  }
  console.warn(`[VKify] Альбом ${ownerId}_${albumId} — фото не получены`);
  return [];
}

/** Скачивает фото как байты с 1 retry. */
export async function fetchPhotoBytes(url: string): Promise<Uint8Array<ArrayBuffer> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return new Uint8Array(await resp.arrayBuffer());
    } catch (err) {
      if (attempt === 1) {
        console.warn(`[VKify] fetch photo failed (${url}):`, err);
        return null;
      }
      await sleep(400);
    }
  }
  return null;
}
