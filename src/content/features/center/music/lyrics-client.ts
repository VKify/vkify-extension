import type { LyricsResult } from '@/shared/lyrics.js';

export async function fetchTimedLyrics(artist: string, title: string, duration: number): Promise<LyricsResult | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({ type: 'AUDIO_FETCH_LYRICS', artist, title, duration }),
      new Promise<undefined>(resolve => { timeout = setTimeout(() => resolve(undefined), 20000); }),
    ]) as
      (LyricsResult & { success: boolean }) | undefined;
    if (!response?.success || !Array.isArray(response.lines)) return null;
    const lines = response.lines.slice(0, 2000).filter(line => line && typeof line.text === 'string'
      && (line.startTime === undefined || Number.isFinite(line.startTime))
      && (line.endTime === undefined || Number.isFinite(line.endTime)))
      .map(line => ({ ...line, text: line.text.slice(0, 2000) }));
    if (response.synced) lines.sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
    return { ...response, lines, lyrics: typeof response.lyrics === 'string' ? response.lyrics.slice(0, 100000) : '' };
  } catch { return null; }
  finally { clearTimeout(timeout); }
}
