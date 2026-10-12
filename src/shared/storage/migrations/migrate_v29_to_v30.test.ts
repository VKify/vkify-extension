import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, backupKey } from '../../constants/storage.js';
import { Migrator } from '../Migrator.js';
import { migrateV29ToV30 } from './migrate_v29_to_v30.js';
import type { RawSettings } from './types.js';

describe('v30 static header settings', () => {
  it('keeps existing installations and saved profiles on native header behavior', () => {
    const old = { custom_theme: '#202020', appearance_profiles: [
      { id: 'old', settings: { fixed_sidebar: true } },
      { id: 'enabled', settings: { static_header: true } },
      { id: 'disabled', settings: { static_header: false } },
      null, { id: 'invalid', settings: null },
    ] };
    const before = structuredClone(old);
    const next = migrateV29ToV30.migrate(old);
    expect(next).toEqual({ ...old, static_header: false, appearance_profiles: [
      { id: 'old', settings: { fixed_sidebar: true, static_header: false } },
      ...old.appearance_profiles.slice(1),
    ] });
    expect(old).toEqual(before);
    expect(migrateV29ToV30.migrate(next)).toEqual(next);
  });

  it.each([true, false])('preserves an existing static header preference (%s)', value => {
    expect(migrateV29ToV30.migrate({ static_header: value, unrelated: 42 }))
      .toEqual({ static_header: value, unrelated: 42 });
  });

  it.each([undefined, null, 'true', 1])('repairs an invalid preference (%s)', value => {
    expect(migrateV29ToV30.migrate({ static_header: value }).static_header).toBe(false);
  });

  it('runs the registered upgrade once and retains a v29 backup', async () => {
    const old = { schema_version: 29, static_header: true, unrelated: 'keep' };
    const data: RawSettings = structuredClone(old);
    const migrator = new Migrator({
      getAll: async () => structuredClone(data),
      setMultiple: async patch => { Object.assign(data, patch); },
      remove: async keys => { keys.forEach(key => { delete data[key]; }); },
    }, { verbose: false });
    await migrator.migrate();
    expect(data).toMatchObject({ ...old, schema_version: CURRENT_SCHEMA_VERSION });
    expect(data[backupKey(29)]).toMatchObject(old);
    const upgraded = structuredClone(data);
    await migrator.migrate();
    expect(data).toEqual(upgraded);
  });
});
