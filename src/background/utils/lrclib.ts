import { lyricsKey, parseSyncedLyrics, type LyricsResult } from '@/shared/lyrics.js';
import { fetchGeniusLyrics } from './lyrics.js';

const cache = new Map<string, { expires: number; value: Promise<LyricsResult> }>();
let retryAfter = 0;
let queue: Promise<unknown> = Promise.resolve();
const normalize = (value: string): string => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

async function request(artist: string, title: string, duration: number): Promise<LyricsResult> {
  if (Date.now() >= retryAfter) {
    try {
      const query = new URLSearchParams({ artist_name: artist.trim(), track_name: title.trim(), duration: String(duration) });
      const response = await fetch(`https://lrclib.net/api/get?${query}`, {
        headers: { Accept: 'application/json', 'Lrclib-Client': 'VKify (https://vkify.ru)' },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 429) {
        const header = response.headers.get('Retry-After');
        const seconds = header ? Number(header) : NaN;
        retryAfter = Number.isFinite(seconds) ? Date.now() + Math.max(1, seconds) * 1000
          : Math.max(Date.now() + 60000, Date.parse(header ?? '') || 0);
      }
      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        // Even /get is a fuzzy lookup. Reject a different recording or version explicitly.
        if (data && typeof data.artistName === 'string' && typeof data.trackName === 'string'
          && normalize(data.artistName) === normalize(artist) && normalize(data.trackName) === normalize(title)
          && typeof data.duration === 'number' && Math.abs(data.duration - duration) <= 2) {
          const parsed = typeof data.syncedLyrics === 'string' ? parseSyncedLyrics(data.syncedLyrics, duration) : [];
          // A single timestamp (often a placeholder at 00:00) is not a usable synchronized song.
          const lines = parsed.length >= 2 ? parsed : [];
          const lyrics = typeof data.plainLyrics === 'string' ? data.plainLyrics.slice(0, 100000) : lines.map(line => line.text).join('\n');
          if (lines.length || lyrics || data.instrumental === true) return { lyrics, lines, synced: lines.length > 0, source: 'lrclib' };
        }
      }
    } catch { /* Offline, timeout and invalid responses are optional-data failures. */ }
  }
  const lyrics = await fetchGeniusLyrics(artist, title);
  return { lyrics, lines: [], synced: false, source: lyrics ? 'genius' : 'none' };
}

/** Duration is part of the cache key: album, radio and live cuts must never share timing. */
export function fetchTimedLyrics(artist: string, title: string, duration: number): Promise<LyricsResult> {
  const key = `${lyricsKey(artist, title)}:${duration}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const entry = { expires: Infinity, value: Promise.resolve<LyricsResult>({ lyrics: '', lines: [], synced: false, source: 'none' }) };
  // Serialize different tracks as well as coalescing identical requests across tabs.
  entry.value = queue.then(() => request(artist, title, duration)).then(result => {
    entry.expires = Date.now() + (result.synced ? 3600000 : 60000);
    return result;
  });
  queue = entry.value.then(() => new Promise(resolve => setTimeout(resolve, 250)), () => {});
  cache.delete(key); cache.set(key, entry);
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  return entry.value;
}
