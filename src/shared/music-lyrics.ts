import { parseVisualizerSettings, VISUALIZER_DEFAULTS, type VisualizerSettings } from './music-visualizer.js';
import type { LyricsResult, LyricTrack } from './lyrics.js';

export const LYRICS_DEFAULTS: VisualizerSettings = {
  ...VISUALIZER_DEFAULTS, mode: 'lyrics', position: 'full', opacity: 95,
  colorMode: 'custom', color: '#f1f5f9', lyricsStyle: 'flow',
  lyricsAvoidContent: true, lyricsSize: 75, lyricsLineCount: 3, lyricsSecondaryOpacity: 16, glow: 0, intensity: 25,
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

export const LYRICS_PRESETS = [
  { id: 'stage', color: '#ffffff', patch: { color: '#ffffff', lyricsFontWeight: '800', lyricsSize: 105, lyricsLineCount: 5, lyricsSecondaryOpacity: 30, lyricsLineSpacing: 115, lyricsAlignment: 'left', intensity: 0 } },
  { id: 'velvet', color: '#f5e9ff', patch: { color: '#f5e9ff', lyricsFontWeight: '700', lyricsSize: 90, lyricsLineCount: 3, lyricsSecondaryOpacity: 22, lyricsLineSpacing: 160, lyricsAlignment: 'left', intensity: 0 } },
  { id: 'spotlight', color: '#fafafa', patch: { color: '#fafafa', lyricsFontWeight: '600', lyricsStyle: 'focus', lyricsNeighbors: false, lyricsSize: 90, lyricsAlignment: 'center', intensity: 0 } },
  { id: 'minimal', color: '#f1f5f9', patch: { lyricsStyle: 'focus', lyricsNeighbors: false, lyricsAlignment: 'center', lyricsSize: 65, lyricsFontWeight: '500' } },
  { id: 'editorial', color: '#e2e8f0', patch: { lyricsSize: 85, lyricsAlignment: 'left', lyricsLineCount: 3, lyricsLineSpacing: 130 } },
  { id: 'soft', color: '#c4b5fd', patch: { color: '#c4b5fd', lyricsAlignment: 'center', lyricsSize: 75, lyricsSecondaryOpacity: 12, lyricsLineSpacing: 140 } },
  { id: 'cinema', color: '#fafaf9', patch: { color: '#fafaf9', lyricsStyle: 'focus', lyricsNeighbors: false, lyricsAlignment: 'center', lyricsSize: 55, position: 'bottom', offsetY: 12, lyricsFontWeight: '600' } },
  { id: 'gallery', color: '#fecdd3', patch: { color: '#fecdd3', lyricsStyle: 'focus', lyricsNeighbors: false, lyricsAlignment: 'center', lyricsSize: 65, offsetY: 20, lyricsShowCover: true, lyricsCoverSize: 28, lyricsCoverX: 50, lyricsCoverY: 10, lyricsCoverRadius: 8 } },
  { id: 'mono', color: '#a7f3d0', patch: { color: '#a7f3d0', lyricsSize: 60, lyricsLineCount: 5, lyricsSecondaryOpacity: 20, lyricsLineSpacing: 140 } },
] as const;
export function lyricsPreset(id: string): VisualizerSettings {
  const value = parseLyricsSettings({ ...LYRICS_DEFAULTS, lyricsAvoidContent: true, ...LYRICS_PRESETS.find(p => p.id === id)?.patch });
  // Mirror the original left-aligned presets; centered typography stays centered in the free area.
  if (value.lyricsAlignment === 'left') value.lyricsAlignment = 'right';
  return value;
}
