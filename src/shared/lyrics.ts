export interface LyricLine { text: string; startTime?: number; endTime?: number }
export interface LyricTrack { id: string; artist: string; title: string; coverUrl?: string }
export interface LyricPlayback { track?: LyricTrack; currentTime: number; duration: number }
export interface LyricsResult {
  lyrics: string;
  lines: LyricLine[];
  synced: boolean;
  source: 'lrclib' | 'genius' | 'none';
}

/** LRC timestamps are seconds in the player's timeline, never estimated from line count. */
export function parseSyncedLyrics(lrc: string, duration: number): LyricLine[] {
  const input = lrc.slice(0, 100000);
  const offset = Number(input.match(/\[offset:\s*([+-]?\d+)\s*\]/i)?.[1] ?? 0) / 1000;
  const entries: Array<{ text: string; startTime: number }> = [];
  for (const row of input.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length || !row.trimStart().startsWith(stamps[0][0])) continue;
    const text = row.replace(/\[\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?\]/g, '').trim();
    for (const stamp of stamps) {
      const time = Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] ?? 0}`) - offset;
      if (time < duration) entries.push({ text, startTime: Math.max(0, time) });
      if (entries.length >= 2000) break;
    }
    if (entries.length >= 2000) break;
  }
  entries.sort((a, b) => a.startTime - b.startTime);
  const groups: typeof entries = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last?.startTime === entry.startTime) {
      if (entry.text && last.text !== entry.text) last.text = [last.text, entry.text].filter(Boolean).join(' / ');
    } else groups.push({ ...entry });
  }
  // Blank timestamped rows end the previous line during instrumental breaks.
  return groups.map((line, i) => ({ ...line, endTime: groups[i + 1]?.startTime ?? duration }))
    .filter(line => line.text).slice(0, 1000);
}

export function lyricsKey(artist: string, title: string): string {
  const normalize = (text: string): string => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  return JSON.stringify([normalize(artist), normalize(title)]);
}

/** Plain Genius text deliberately retains no invented timestamps. */
export function prepareLyrics(text: string): LyricLine[] {
  return text.slice(0, 100000).split(/\r?\n/).map(text => text.trim())
    .filter(text => text && !/^\[.*\]$/.test(text)).slice(0, 1000).map(text => ({ text }));
}

export function lyricIndex(lines: readonly LyricLine[], time: number, duration: number): number {
  if (!lines.length || !Number.isFinite(time)) return -1;
  if (lines.every(line => Number.isFinite(line.startTime))) {
    let index = -1;
    for (let i = 0; i < lines.length && lines[i].startTime! <= time; i++) index = i;
    return index >= 0 && (lines[index].endTime === undefined || time < lines[index].endTime!) ? index : -1;
  }
  if (!Number.isFinite(duration) || duration <= 0) return -1;
  return Math.min(lines.length - 1, Math.floor(Math.max(0, time) / duration * lines.length));
}
