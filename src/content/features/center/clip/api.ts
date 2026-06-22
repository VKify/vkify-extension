/**
 * Определение страницы клипов, активного клипа и получение его прямых
 * ссылок через video.get (с дедупликацией параллельных запросов).
 */

import { vkApi } from '@/content/api/vk-api-client.js';
import type { VideoItem, VideoGetResponse } from './types.js';

export function isClipsPage(): boolean {
  const host = window.location.hostname;
  if (host !== 'vk.com' && host !== 'vk.ru' && host !== 'vkvideo.ru') return false;
  return /^\/clips?(?:[-_/]|$)/.test(window.location.pathname);
}

export function findActiveClipId(): { ownerId: number; videoId: number } | null {
  const m = window.location.pathname.match(/\/clip(-?\d+)_(\d+)/);
  if (m) return { ownerId: Number(m[1]), videoId: Number(m[2]) };

  for (const card of document.querySelectorAll<HTMLElement>('[data-snap-key]')) {
    const player = card.querySelector('[class*="vkitClipPlayerContainer__playerContainer"]');
    if (!player) continue;
    if (Array.from(player.classList).some(c => c.includes('playerContainerHidden'))) continue;
    const km = (card.getAttribute('data-snap-key') ?? '').match(/^(-?\d+)_(\d+)$/);
    if (km) return { ownerId: Number(km[1]), videoId: Number(km[2]) };
  }
  return null;
}

const fetchCache = new Map<string, Promise<VideoItem | null>>();

export async function fetchClipData(ownerId: number, videoId: number): Promise<VideoItem | null> {
  const key = `${ownerId}_${videoId}`;
  let pending = fetchCache.get(key);
  if (pending) return pending;

  pending = (async () => {
    try {
      const resp = await vkApi.call('video.get', { videos: key, extended: 0 }) as VideoGetResponse;
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
