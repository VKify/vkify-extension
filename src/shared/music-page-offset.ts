import { parseLyricsSettings } from './music-lyrics.js';
import { parseVisualizerSettings } from './music-visualizer.js';
import { musicPageOffsetPatch } from './lyrics-layout.js';

export const MUSIC_OFFSET_STATE = 'music_page_offset_restore';
const relevant = ['music_lyrics', 'music_visualizer', 'music_lyrics_settings', 'music_visualizer_settings', 'page_offset_enabled', 'page_offset_value'];
export const changesMusicOffset = (patch: Record<string, unknown>): boolean => relevant.some(key => key in patch);

/** One transaction for both consumers: preserve manual settings until the last owner releases them. */
export function withMusicPageOffset(current: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  if (!changesMusicOffset(patch)) return patch;
  const next = { ...current, ...patch };
  const result = { ...patch };
  let saved: { enabled: boolean; value: number; applied: number } | null = null;
  try {
    const v = JSON.parse(String(current[MUSIC_OFFSET_STATE] || 'null'));
    if (v && typeof v.enabled === 'boolean' && Number.isFinite(v.value) && Number.isFinite(v.applied)) saved = v;
  } catch { /* no valid ownership */ }
  const lyrics = parseLyricsSettings(next.music_lyrics_settings);
  const visualizer = parseVisualizerSettings(next.music_visualizer_settings);
  // Editing Appearance is an explicit manual override, not something automation should fight.
  if ('page_offset_enabled' in patch || 'page_offset_value' in patch) {
    if (saved) {
      if (next.music_lyrics === true) result.music_lyrics_settings = JSON.stringify({ ...lyrics, lyricsAvoidContent: false });
      if (next.music_visualizer === true) result.music_visualizer_settings = JSON.stringify({ ...visualizer, visualizerAvoidContent: false });
      result[MUSIC_OFFSET_STATE] = '';
    }
    return result;
  }
  const demand = next.music_lyrics === true ? musicPageOffsetPatch(lyrics).page_offset_value : undefined;
  const target = demand ?? (next.music_visualizer === true ? musicPageOffsetPatch(visualizer).page_offset_value : undefined);
  if (target === undefined) {
    if (saved) {
      // An external/manual writer may have changed Appearance without using this transaction.
      if (current.page_offset_enabled === true && current.page_offset_value === saved.applied) {
        result.page_offset_enabled = saved.enabled; result.page_offset_value = saved.value;
      }
      result[MUSIC_OFFSET_STATE] = '';
    }
    return result;
  }
  const baseline = saved ?? { enabled: current.page_offset_enabled === true, value: typeof current.page_offset_value === 'number' ? current.page_offset_value : 50, applied: target };
  result.page_offset_enabled = true; result.page_offset_value = target;
  result[MUSIC_OFFSET_STATE] = JSON.stringify({ ...baseline, applied: target });
  return result;
}
