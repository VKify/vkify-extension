/** Парсинг id видео из URL и получение прямых ссылок через video.get. */

import { getService, SERVICES } from '@/content/core/services/index.js';
import type { VideoQualityFiles } from '../_shared/index.js';
import type { VideoGetResponse } from './types.js';

export function parseVideoIds(pathname: string): { ownerId: number; videoId: number } | null {
  const m = pathname.match(/\/video(-?\d+)_(\d+)/);
  if (!m) return null;
  return { ownerId: Number(m[1]), videoId: Number(m[2]) };
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
