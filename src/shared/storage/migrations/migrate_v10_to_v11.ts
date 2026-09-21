import type { Migration, RawSettings } from './types.js';
import { parseVisualizerSettings } from '../../music-visualizer.js';

/** Add visualizer defaults without overwriting existing user choices. */
export const migrateV10ToV11: Migration = {
  to: 11,
  description: 'Normalize music visualizer settings and add placement and pause defaults',
  migrate(old: RawSettings): RawSettings {
    return {
      ...old,
      music_visualizer: typeof old.music_visualizer === 'boolean' ? old.music_visualizer : false,
      music_visualizer_settings: JSON.stringify(parseVisualizerSettings(old.music_visualizer_settings)),
    };
  },
};
