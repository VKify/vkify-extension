/**
 * Мост к инжектированному скрипту (page context): расшифровка VK audio URL
 * и получение полного списка треков плейлиста через al_audio.php.
 */

import { dispatchPageEvent } from '@/content/utils/page-event.js';
import type { TrackEntry } from './types.js';

let reqCounter = 0;

/** Запрашивает реальный m3u8-URL трека у инжектированного декодера. */
export function requestUrl(entry: TrackEntry): Promise<string> {
  return new Promise<string>((resolve) => {
    const requestId = `${entry.trackId}_${++reqCounter}`;

    const handler = (e: Event): void => {
      const d = (e as CustomEvent<{ requestId: string; url: string }>).detail;
      if (d.requestId !== requestId) return;
      window.removeEventListener('vkify:audio:url-response', handler);
      resolve(d.url ?? '');
    };

    window.addEventListener('vkify:audio:url-response', handler);
    setTimeout(() => {
      window.removeEventListener('vkify:audio:url-response', handler);
      resolve('');
    }, 12000);

    dispatchPageEvent('vkify:audio:get-url', { requestId, audioData: entry.audioData });
  });
}

/** Полный список треков плейлиста через инжектированный al_audio.php. */
export function requestPlaylist(ownerId: string, playlistId: string, accessHash: string): Promise<unknown[][]> {
  return new Promise((resolve) => {
    const requestId = `pl_${++reqCounter}`;
    const handler = (e: Event): void => {
      const d = (e as CustomEvent<{ requestId: string; list: unknown[][] }>).detail;
      if (d.requestId !== requestId) return;
      window.removeEventListener('vkify:audio:playlist-response', handler);
      resolve(Array.isArray(d.list) ? d.list : []);
    };
    window.addEventListener('vkify:audio:playlist-response', handler);
    setTimeout(() => { window.removeEventListener('vkify:audio:playlist-response', handler); resolve([]); }, 30000);
    dispatchPageEvent('vkify:audio:get-playlist', { requestId, ownerId, playlistId, accessHash });
  });
}
