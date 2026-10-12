import { describe, expect, it } from 'vitest';
import { migrateV27ToV28 } from './migrate_v27_to_v28.js';
import { DEFAULT_LOGO_COLOR, LOGO_COLOR_MODES } from '../../custom-logo.js';
import { Migrator } from '../Migrator.js';
import { CURRENT_SCHEMA_VERSION, backupKey } from '../../constants/storage.js';
import type { RawSettings } from './types.js';

describe('v28 logo color preferences', () => {
  it('keeps existing images unchanged and initializes their original colors', () => {
    const old = Object.freeze({ custom_logo_enabled: true, custom_logo: 'data:image/png;base64,aGVsbG8=', unrelated: 42 });
    const next = migrateV27ToV28.migrate(old);
    expect(next).toEqual({ ...old, custom_logo_color_mode: 'original', custom_logo_color: DEFAULT_LOGO_COLOR });
    expect(old).not.toHaveProperty('custom_logo_color');
    expect(migrateV27ToV28.migrate(next)).toEqual(next);
  });
  it('preserves valid modes and repairs malformed preferences', () => {
    for (const mode of LOGO_COLOR_MODES) {
      expect(migrateV27ToV28.migrate({ custom_logo_color_mode: mode, custom_logo_color: '#ef1234' }))
        .toMatchObject({ custom_logo_color_mode: mode, custom_logo_color: '#ef1234' });
    }
    expect(migrateV27ToV28.migrate({ custom_logo_color_mode: 'bad', custom_logo_color: 'url(x)' }))
      .toMatchObject({ custom_logo_color_mode: 'original', custom_logo_color: DEFAULT_LOGO_COLOR });
  });
  it('upgrades a v27 installation with a backup', async () => {
    const old = { schema_version: 27, custom_logo_enabled: true, custom_logo: 'https://example.com/logo.png' };
    const data: RawSettings = { ...old };
    await new Migrator({ getAll: async () => structuredClone(data),
      setMultiple: async patch => { Object.assign(data, patch); },
      remove: async keys => { keys.forEach(key => { delete data[key]; }); },
    }, { verbose: false }).migrate();
    expect(data).toMatchObject({ schema_version: CURRENT_SCHEMA_VERSION, custom_logo: old.custom_logo, custom_logo_color_mode: 'original' });
    expect(data[backupKey(27)]).toMatchObject(old);
  });
});
