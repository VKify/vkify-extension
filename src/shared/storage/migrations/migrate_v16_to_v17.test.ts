import { describe, expect, it } from 'vitest';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';
import { migrateV16ToV17 } from './migrate_v16_to_v17.js';

describe('v17 open-profile block hiding', () => {
  it('adds a disabled preference and preserves existing values without mutation', () => {
    const old = Object.freeze({ hide_promo_link: true, custom_font: 'Existing' });
    expect(migrateV16ToV17.migrate(old)).toEqual({ ...old, hide_open_profile_block: false });
    expect(old).not.toHaveProperty('hide_open_profile_block');
    for (const value of [true, false]) {
      const settings = Object.freeze({ ...old, hide_open_profile_block: value });
      const next = migrateV16ToV17.migrate(settings);
      expect(next).toEqual(settings);
      expect(migrateV16ToV17.migrate(next)).toEqual(next);
    }
  });

  it('backs up v16 through the registry and runs only once', async () => {
    const data: RawSettings = { schema_version: 16, hide_promo_link: true };
    const original = structuredClone(data);
    const migrator = new Migrator({
      async getAll() { return structuredClone(data); },
      async setMultiple(values) { Object.assign(data, structuredClone(values)); },
      async remove(keys) { keys.forEach(key => delete data[key]); },
    }, { verbose: false });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 17, appliedSteps: [17], backupKey: 'settings_backup_v16' });
    expect(data.settings_backup_v16).toEqual(original);
    expect(data).toMatchObject({ schema_version: 17, hide_promo_link: true, hide_open_profile_block: false });
    const first = structuredClone(data);
    expect(await migrator.migrate()).toMatchObject({ migrated: false, appliedSteps: [] });
    expect(data).toEqual(first);
  });
});
