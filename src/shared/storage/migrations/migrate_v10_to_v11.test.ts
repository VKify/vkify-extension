import { describe, expect, it } from 'vitest';
import { migrateV10ToV11 } from './migrate_v10_to_v11.js';
import { VISUALIZER_DEFAULTS } from '../../music-visualizer.js';

describe('visualizer settings migration', () => {
  it('adds defaults to missing and corrupt settings', () => {
    for (const raw of [undefined, '{broken', 'null', '[]']) {
      const next = migrateV10ToV11.migrate({ music_visualizer_settings: raw });
      expect(next.music_visualizer).toBe(false);
      expect(JSON.parse(next.music_visualizer_settings as string)).toEqual(VISUALIZER_DEFAULTS);
    }
  });
  it('preserves user choices, fills new fields and is idempotent without mutating input', () => {
    const old = { music_visualizer: true, custom_accent: '#123456', music_visualizer_settings: '{"mode":"wave","opacity":42,"width":130,"hideWhenPaused":true}' };
    const next = migrateV10ToV11.migrate(old);
    expect(next.music_visualizer).toBe(true);
    expect(next.custom_accent).toBe(old.custom_accent);
    expect(JSON.parse(next.music_visualizer_settings as string)).toEqual({ ...VISUALIZER_DEFAULTS, mode: 'wave', opacity: 42, width: 130, hideWhenPaused: true });
    expect(migrateV10ToV11.migrate(next)).toEqual(next);
    expect(JSON.parse(old.music_visualizer_settings)).not.toHaveProperty('height');
  });
});
