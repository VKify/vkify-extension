import { describe, expect, it } from 'vitest';
import { migrateV35ToV36 } from './migrate_v35_to_v36.js';
import { Migrator } from '../Migrator.js';
import { backupKey } from '../../constants/storage.js';
import type { RawSettings } from './types.js';

const defaults = {
  edge_sidebar_width: 0, edge_sidebar_background: 'theme', edge_sidebar_color: '#1f2937',
  edge_sidebar_opacity: 100, edge_sidebar_blur: 0, edge_sidebar_item_radius: 8, edge_sidebar_item_height: 38,
};

describe('v35 → v36 edge sidebar appearance', () => {
  it.each([true, false])('initializes defaults without changing menu mode (%s)', enabled => {
    const old = { edge_sidebar: enabled, fixed_sidebar: true, unrelated: 'keep' };
    const next = migrateV35ToV36.migrate(old);
    expect(next).toEqual({ ...old, ...defaults });
    expect(old).toEqual({ edge_sidebar: enabled, fixed_sidebar: true, unrelated: 'keep' });
    expect(migrateV35ToV36.migrate(next)).toEqual(next);
  });

  it('preserves customized settings and valid zero values', () => {
    const custom = { edge_sidebar_width: 260, edge_sidebar_background: 'custom', edge_sidebar_color: '#ABCDEF',
      edge_sidebar_opacity: 0, edge_sidebar_blur: 0, edge_sidebar_item_radius: 0, edge_sidebar_item_height: 32 };
    expect(migrateV35ToV36.migrate(custom)).toEqual(custom);
    expect(migrateV35ToV36.migrate({ ...custom, edge_sidebar_background: 'transparent' }).edge_sidebar_background).toBe('transparent');
  });

  it('repairs invalid stored values', () => {
    expect(migrateV35ToV36.migrate({
      edge_sidebar_width: 100, edge_sidebar_background: 'invalid', edge_sidebar_color: 'red;display:none',
      edge_sidebar_opacity: '50', edge_sidebar_blur: Infinity, edge_sidebar_item_radius: -1, edge_sidebar_item_height: NaN,
    })).toEqual(defaults);
  });

  it('migrates saved profiles without mutating inputs or malformed entries', () => {
    const old = { appearance_profiles: [
      { id: 'old', name: 'Old', settings: { edge_sidebar: true } },
      { id: 'custom', settings: { edge_sidebar_width: 280, edge_sidebar_opacity: 75 } },
      null, { id: 'missing' }, { settings: [] }, 'malformed',
    ] };
    const before = structuredClone(old);
    const next = migrateV35ToV36.migrate(old);
    expect(next.appearance_profiles).toEqual([
      { id: 'old', name: 'Old', settings: { edge_sidebar: true, ...defaults } },
      { id: 'custom', settings: { ...defaults, edge_sidebar_width: 280, edge_sidebar_opacity: 75 } },
      null, { id: 'missing' }, { settings: [] }, 'malformed',
    ]);
    expect(old).toEqual(before);
    expect(migrateV35ToV36.migrate(next)).toEqual(next);
  });

  it('upgrades registered v35 storage with a recoverable backup', async () => {
    const old = { schema_version: 35, edge_sidebar: true, edge_sidebar_width: 250,
      appearance_profiles: [{ id: 'saved', settings: { edge_sidebar: false } }] };
    const data: RawSettings = structuredClone(old);
    const migrator = new Migrator({
      getAll: async () => ({ ...data }),
      setMultiple: async patch => { Object.assign(data, patch); },
      remove: async keys => { for (const key of keys) delete data[key]; },
    }, { verbose: false, targetVersion: 36 });
    const result = await migrator.migrate();
    expect(result.appliedSteps).toEqual([36]);
    expect(data).toMatchObject({ ...defaults, schema_version: 36, edge_sidebar: true, edge_sidebar_width: 250 });
    expect(data[backupKey(35)]).toEqual(old);
    expect(data.appearance_profiles).toEqual([{ id: 'saved', settings: { ...defaults, edge_sidebar: false } }]);
    expect((await migrator.migrate()).migrated).toBe(false);
  });
});
