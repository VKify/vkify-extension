import type { Migration } from './types.js';
import { parseLyricsSettings } from '../../music-lyrics.js';
import { VISUALIZER_DEFAULTS } from '../../music-visualizer.js';

export const migrateV11ToV12: Migration = {
  to: 12,
  description: 'Separate background lyrics from the music visualizer, preserving lyrics configuration',
  migrate(old) {
    let previous: Record<string, unknown> = {};
    try { previous = JSON.parse(String(old.music_visualizer_settings ?? '{}')) ?? {}; } catch { /* defaults */ }
    const wasLyrics = previous.mode === 'lyrics';
    return {
      ...old,
      music_lyrics: typeof old.music_lyrics === 'boolean' ? old.music_lyrics : wasLyrics && old.music_visualizer === true,
      music_lyrics_settings: JSON.stringify(parseLyricsSettings(old.music_lyrics_settings ?? (wasLyrics ? previous : undefined))),
      ...(wasLyrics ? { music_visualizer: false, music_visualizer_settings: JSON.stringify(VISUALIZER_DEFAULTS) } : {}),
    };
  },
};
