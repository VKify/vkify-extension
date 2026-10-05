import { describe, expect, it } from 'vitest';
import { CLOCK_DEFAULTS, parseClockSettings } from '../../clock/settings.js';
import { CLOCK_PRESETS } from '../../clock/presets.js';
import { Migrator } from '../Migrator.js';
import { migrateV23ToV24 } from './migrate_v23_to_v24.js';
import type { RawSettings } from './types.js';

describe('v24 extended clock appearance', () => {
  it('adds defaults without changing legacy clock preferences or mutating input', () => {
    const clock = { seconds: true, showDate: true, output: 'widget', position: 'custom',
      x: 37, y: 62, color: '#abcdef', fontSize: 36, glass: true, backgroundOpacity: 35 };
    const old = Object.freeze({ clock_enabled: false, clock_settings: JSON.stringify(clock), unrelated: 42 });
    const next = migrateV23ToV24.migrate(old);
    expect(next).toMatchObject({ clock_enabled: false, unrelated: 42 });
    expect(parseClockSettings(next.clock_settings)).toEqual({ ...CLOCK_DEFAULTS, ...clock });
    expect(old.clock_settings).toBe(JSON.stringify(clock));
    expect(migrateV23ToV24.migrate(next)).toEqual(next);
  });

  it('repairs missing or corrupted settings and preserves already customized styles', () => {
    for (const raw of [undefined, '{', '[]', '{"glow":100,"borderColor":"url(x)"}']) {
      expect(parseClockSettings(migrateV23ToV24.migrate({ clock_settings: raw }).clock_settings)).toEqual(CLOCK_DEFAULTS);
    }
    const clock = { ...CLOCK_DEFAULTS, ...CLOCK_PRESETS.neon, showDate: true, dateLayout: 'above' as const };
    const next = migrateV23ToV24.migrate({ clock_enabled: true, clock_settings: JSON.stringify(clock) });
    expect(next.clock_enabled).toBe(true);
    expect(JSON.parse(next.clock_settings as string)).toEqual(clock);
  });

  it('backs up a v23 installation and runs the registered upgrade only once', async () => {
    const data: RawSettings = { schema_version: 23, clock_enabled: true,
      clock_settings: '{"seconds":true,"position":"top-right","fontSize":42}' };
    const old = structuredClone(data);
    const migrator = new Migrator({
      getAll: async () => structuredClone(data),
      setMultiple: async patch => { Object.assign(data, structuredClone(patch)); },
      remove: async keys => { keys.forEach(key => delete data[key]); },
    }, { verbose: false });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 24, appliedSteps: [24] });
    expect(data.settings_backup_v23).toEqual(old);
    expect(data.schema_version).toBe(24);
    expect(parseClockSettings(data.clock_settings)).toMatchObject({ seconds: true, position: 'top-right', fontSize: 42, glow: 0, fontFamily: 'system' });
    expect(await migrator.migrate()).toMatchObject({ migrated: false });
  });
});
