import type { LyricsResult } from '@/shared/lyrics.js';

export async function fetchTimedLyrics(artist: string, title: string, duration: number): Promise<LyricsResult | null> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'AUDIO_FETCH_LYRICS', artist, title, duration }) as
      (LyricsResult & { success: boolean }) | undefined;
    return response?.success && Array.isArray(response.lines) ? response : null;
  } catch { return null; }
}
