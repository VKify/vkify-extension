/** Парсинг id видео из URL и получение прямых ссылок через video.get. */

import { getService, SERVICES } from '@/content/core/services/index.js';
import type { VideoQualityFiles } from '../_shared/index.js';
import type { VideoGetResponse, VideoItem } from './types.js';

export interface PlaylistIds { ownerId: number; albumId: number }

export function parseVideoIds(
  loc: { pathname: string; search: string },
): { ownerId: number; videoId: number } | null {
  // Прямой URL: /video-123_456 (vkvideo.ru и ссылки vk.ru).
  const direct = loc.pathname.match(/\/video(-?\d+)_(\d+)/);
  if (direct) return { ownerId: Number(direct[1]), videoId: Number(direct[2]) };

  // Модальная обёртка: любой путь + ?z=video-123_456[/pl_...] —
  // например https://vk.ru/vkify?z=video-52620949_456239272%2Fpl_wall.
  const z = new URLSearchParams(loc.search).get('z');
  const wrapped = z?.match(/^video(-?\d+)_(\d+)/);
  if (wrapped) return { ownerId: Number(wrapped[1]), videoId: Number(wrapped[2]) };

  return null;
}

export async function fetchVideoData(
  ownerId: number,
  videoId: number,
): Promise<{ files: VideoQualityFiles; title: string } | null> {
  try {
    const resp = await getService(SERVICES.vkApi).call('video.get', {
      videos:   `${ownerId}_${videoId}`,
      extended: 0,
    }) as VideoGetResponse;
    const item = resp?.items?.[0];
    if (!item) return null;
    return { files: item.files ?? {}, title: item.title ?? 'video' };
  } catch {
    return null;
  }
}

/** Читает идентификаторы плейлиста как с /playlist/…, так и из ?pl=…. */
export function parsePlaylistIds(
  loc: { pathname: string; search: string },
): PlaylistIds | null {
  const path = loc.pathname.match(/\/playlist\/(-?\d+)_(\d+)/);
  const query = new URLSearchParams(loc.search).get('pl')?.match(/^(-?\d+)_(\d+)$/);
  const match = path ?? query;
  return match ? { ownerId: Number(match[1]), albumId: Number(match[2]) } : null;
}

/** Загружает весь плейлист страницами, не полагаясь на виртуализацию списка. */
export async function fetchPlaylistVideos(
  ownerId: number,
  albumId: number,
): Promise<VideoItem[]> {
  const result: VideoItem[] = [];
  const count = 200;
  for (let offset = 0; ; offset += count) {
    const resp = await getService(SERVICES.vkApi).call('video.get', {
      owner_id: ownerId,
      album_id: albumId,
      count,
      offset,
      extended: 0,
    }) as VideoGetResponse;
    const items = resp?.items ?? [];
    result.push(...items);
    if (items.length < count || result.length >= (resp.count ?? 0)) break;
  }
  return result;
}
