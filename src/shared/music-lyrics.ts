import { parseVisualizerSettings, VISUALIZER_DEFAULTS, type VisualizerSettings } from './music-visualizer.js';
import type { LyricsResult, LyricTrack } from './lyrics.js';

export const LYRICS_DEFAULTS: VisualizerSettings = {
  ...VISUALIZER_DEFAULTS, mode: 'lyrics', position: 'full', opacity: 95,
  colorMode: 'custom', color: '#ffffff', lyricsStyle: 'flow',
};

export function parseLyricsSettings(raw: unknown): VisualizerSettings {
  let value: Record<string, unknown> = {};
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw as Record<string, unknown>; } catch { /* defaults */ }
  return parseVisualizerSettings({ ...LYRICS_DEFAULTS, ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}), mode: 'lyrics', lyricsLayoutVersion: 2 });
}

export interface LyricsSnapshot { track?: LyricTrack; result: LyricsResult | null }

export function exportLyrics(result: LyricsResult, format: 'txt' | 'lrc'): string {
  if (format === 'txt') return result.lyrics || result.lines.map(line => line.text).join('\n');
  if (!result.synced) return '';
  const stamp = (seconds: number): string => {
    const ticks = Math.round(seconds * 100);
    return `[${String(Math.floor(ticks / 6000)).padStart(2, '0')}:${String(Math.floor(ticks / 100) % 60).padStart(2, '0')}.${String(ticks % 100).padStart(2, '0')}]`;
  };
  return result.lines.flatMap((line, i) => {
    if (line.startTime === undefined) return [];
    const rows = [stamp(line.startTime) + line.text];
    if (line.endTime !== undefined && (result.lines[i + 1]?.startTime ?? Infinity) > line.endTime) rows.push(stamp(line.endTime));
    return rows;
  }).join('\n');
}

export function lyricsCoverPlacement(w: number, h: number, s: VisualizerSettings) {
  const size = Math.min(w, h) * s.lyricsCoverSize / 100;
  return { size, x: (w - size) * s.lyricsCoverX / 100, y: (h - size) * s.lyricsCoverY / 100 };
}
