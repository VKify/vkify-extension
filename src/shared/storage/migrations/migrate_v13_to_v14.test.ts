import { describe, it, expect } from 'vitest';
import { migrateV13ToV14 } from './migrate_v13_to_v14.js';

describe('widget runtime migration', () => {
  it('preserves all legacy positions, hidden membership and unknown widgets', () => {
    const result = migrateV13ToV14.migrate({
      'widgetState:equalizer': { mode: 'stacked', visible: false, order: 7 },
      equalizerPosition: { left: 20, top: 30 }, perfWidgetPosition: { left: 40, top: 50 },
      'widgetPosition:clock': { left: 60, top: 70 },
      'widgetPosition:custom': { left: 80, top: 90 },
      mini_player_left: 100, mini_player_top: 110,
    });
    expect(result['widget:equalizer']).toEqual({ mode: 'stacked', visible: false, order: 7, position: { left: 20, top: 30 }, hideHeader: false, autoHide: false });
    expect(result['widget:perf-widget']).toMatchObject({ position: { left: 40, top: 50 } });
    expect(result['widget:clock']).toMatchObject({ position: { left: 60, top: 70 } });
    expect(result['widget:custom']).toMatchObject({ position: { left: 80, top: 90 } });
    expect(result['widget:music-mini-player']).toMatchObject({ position: { left: 100, top: 110 } });
    expect(result).not.toHaveProperty('equalizerPosition');
    expect(result).not.toHaveProperty('widgetState:equalizer');
  });
  it('preserves explicit resets and existing records, sanitizes corrupt positions and is idempotent', () => {
    const current = { mode: 'free', visible: false, order: 2, position: null };
    const result = migrateV13ToV14.migrate({
      'widget:clock': current, 'widgetPosition:clock': { left: 20, top: 30 },
      'widgetPosition:music-mini-player': null, mini_player_left: 100, mini_player_top: 110,
      equalizerPosition: { left: Infinity, top: 1 }, 'widgetPosition:music_visualizer': null,
    });
    expect(result['widget:clock']).toEqual(current);
    expect(result['widget:music-mini-player']).toMatchObject({ position: null });
    expect(result['widget:equalizer']).toMatchObject({ position: null });
    expect(result['widgetPositionMigration:music_visualizer']).toBeUndefined();
    expect(migrateV13ToV14.migrate(result)).toEqual(result);
  });
});
