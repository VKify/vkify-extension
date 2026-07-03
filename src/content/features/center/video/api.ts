/** Парсинг id видео из URL и получение прямых ссылок через video.get. */

import { getService, SERVICES } from '@/content/core/services/index.js';
import type { VideoQualityFiles } from '../_shared/index.js';
import type { VideoGetResponse } from './types.js';

export function parseVideoIds(
  loc: { pathname: string; search: string },
): { ownerId: number; videoId: number } | null {
  // Прямой URL: /video-123_456 (vkvideo.ru и старые ссылки vk.com).
  const direct = loc.pathname.match(/\/video(-?\d+)_(\d+)/);
  if (direct) return { ownerId: Number(direct[1]), videoId: Number(direct[2]) };

  // Модальная обёртка: любой путь + ?z=video-123_456[/pl_...] —
  // например https://vk.com/vkify?z=video-52620949_456239272%2Fpl_wall.
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
