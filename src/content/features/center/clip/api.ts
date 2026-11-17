/**
 * Определение страницы клипов, активного клипа и получение его прямых
 * ссылок через video.get (с дедупликацией параллельных запросов).
 */

import { getService, SERVICES } from '@/content/core/services/index.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import type { VideoItem, VideoGetResponse } from './types.js';

export function isClipsPage(): boolean {
  const host = window.location.hostname;
  if (host !== 'vk.ru' && host !== 'vkvideo.ru') return false;
  return /^\/clips?(?:[-_/]|$)/.test(window.location.pathname);
}

export function findActiveClipId(): { ownerId: number; videoId: number } | null {
  const active = safeQuerySelector(SELECTORS.clip.activeClip)?.getAttribute('data-clip-id')?.match(/^(-?\d+)_(\d+)$/);
  if (active) return { ownerId: Number(active[1]), videoId: Number(active[2]) };
  const m = window.location.pathname.match(/\/clip(-?\d+)_(\d+)/);
  if (m) return { ownerId: Number(m[1]), videoId: Number(m[2]) };

  return null;
}

const fetchCache = new Map<string, Promise<VideoItem | null>>();

export async function fetchClipData(ownerId: number, videoId: number): Promise<VideoItem | null> {
  const key = `${ownerId}_${videoId}`;
  let pending = fetchCache.get(key);
  if (pending) return pending;

  pending = (async () => {
    try {
      const resp = await getService(SERVICES.vkApi).call('video.get', { videos: key, extended: 0 }) as VideoGetResponse;
      return resp?.items?.[0] ?? null;
    } catch {
      return null;
    }
  })();
  fetchCache.set(key, pending);
  const result = await pending;
  if (result === null) fetchCache.delete(key);
  return result;
}

/** Сбрасывает кэш запросов (при выключении фичи). */
export function clearClipCache(): void {
  fetchCache.clear();
}
