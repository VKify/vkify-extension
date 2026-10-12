import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, backupKey } from '../../constants/storage.js';
import { Migrator } from '../Migrator.js';
import { migrateV26ToV27 } from './migrate_v26_to_v27.js';
import type { RawSettings } from './types.js';

describe('v27 custom header logo settings', () => {
  it('initializes disabled defaults without mutating existing settings', () => {
    const old = Object.freeze({ custom_accent: '#e91e63', unrelated: 42 });
    const next = migrateV26ToV27.migrate(old);
    expect(next).toEqual({ ...old, custom_logo_enabled: false, custom_logo: '' });
    expect(old).not.toHaveProperty('custom_logo');
    expect(migrateV26ToV27.migrate(next)).toEqual(next);
  });

  it.each([true, false])('preserves existing logo preferences when enabled is %s', enabled => {
    for (const resource of ['https://example.com/logo.svg', 'data:image/png;base64,aGVsbG8=']) {
      const old = { custom_logo_enabled: enabled, custom_logo: resource, appearance_profiles: [{ id: 'profile', settings: { custom_logo: resource } }] };
      expect(migrateV26ToV27.migrate(old)).toEqual(old);
    }
  });

  it('repairs invalid switches and unsafe image resources', () => {
    for (const resource of [null, 42, 'javascript:alert(1)', 'data:text/html;base64,aGVsbG8=']) {
      expect(migrateV26ToV27.migrate({ custom_logo_enabled: 'true', custom_logo: resource }))
        .toMatchObject({ custom_logo_enabled: false, custom_logo: '' });
    }
  });

  it('runs the registered upgrade once and retains a recoverable backup', async () => {
    const old = { schema_version: 26, custom_theme: '#202020', unrelated: 'keep' };
    const data: RawSettings = structuredClone(old);
    const migrator = new Migrator({
      getAll: async () => structuredClone(data),
      setMultiple: async patch => { Object.assign(data, patch); },
      remove: async keys => { keys.forEach(key => { delete data[key]; }); },
    }, { verbose: false });
    await migrator.migrate();
    expect(data).toMatchObject({ schema_version: CURRENT_SCHEMA_VERSION, custom_logo_enabled: false, custom_logo: '', unrelated: 'keep' });
    expect(data[backupKey(26)]).toMatchObject(old);
    const upgraded = structuredClone(data);
    await migrator.migrate();
    expect(data).toEqual(upgraded);
  });
});
