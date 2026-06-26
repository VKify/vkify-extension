/** Парсинг id сторис из URL и получение данных через stories.getById. */

import { getService, SERVICES } from '@/content/core/services/index.js';
import type { PhotoSize, StoryItem, StoriesGetByIdResponse } from './types.js';

/** Парсит `?w=story-213482001_456240063%2Ffeed` → `{ownerId, storyId}`. */
export function parseStoryIds(search: string): { ownerId: number; storyId: number } | null {
  const w = new URLSearchParams(search).get('w');
  if (!w) return null;
  const m = w.match(/^story(-?\d+)_(\d+)/);
  if (!m) return null;
  return { ownerId: Number(m[1]), storyId: Number(m[2]) };
}

export async function fetchStoryData(ownerId: number, storyId: number): Promise<StoryItem | null> {
  try {
    const resp = await getService(SERVICES.vkApi).call('stories.getById', {
      stories:  `${ownerId}_${storyId}`,
      extended: 0,
    }) as StoriesGetByIdResponse;
    return resp?.items?.[0] ?? null;
  } catch {
    return null;
  }
}

export function getBestPhotoUrl(sizes: PhotoSize[]): string | null {
  if (!sizes.length) return null;
  return [...sizes].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url;
}
