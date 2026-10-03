import { describe, expect, it } from 'vitest';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';
import { migrateV18ToV19 } from './migrate_v18_to_v19.js';

describe('v19 ad blocking statistics widget', () => {
  it('initializes a disabled widget without changing counters or other preferences', () => {
    const old = Object.freeze({ stats_ads_blocked: 42, stats_trackers_blocked: 7, 'widget:clock': { visible: false } });
    const next = migrateV18ToV19.migrate(old);
    expect(next).toEqual({ ...old, ad_stats_widget: false,
      'widget:ad-stats': { mode: 'free', visible: true, order: 0, position: null } });
    expect(old).not.toHaveProperty('ad_stats_widget');
    expect(migrateV18ToV19.migrate(next)).toEqual(next);
  });

  it.each([true, false])('preserves an existing enabled choice (%s), placement and visibility', ad_stats_widget => {
    const state = Object.freeze({ mode: 'stacked', visible: false, order: 4, position: { left: 20, top: 40 } });
    const old = Object.freeze({ ad_stats_widget, 'widget:ad-stats': state, stats_block_log: [{ kind: 'ad' }] });
    const next = migrateV18ToV19.migrate(old);
    expect(next).toEqual(old);
    expect(next).not.toBe(old);
    expect(next['widget:ad-stats']).toBe(state);
  });

  it('fills only missing fields independently', () => {
    expect(migrateV18ToV19.migrate({ ad_stats_widget: true })).toMatchObject({ ad_stats_widget: true,
      'widget:ad-stats': { mode: 'free', visible: true } });
    expect(migrateV18ToV19.migrate({ 'widget:ad-stats': { mode: 'stacked' } })).toEqual({
      ad_stats_widget: false, 'widget:ad-stats': { mode: 'stacked' },
    });
  });

  it('backs up v18 through the registry and runs only once', async () => {
    const data: RawSettings = { schema_version: 18, stats_ads_blocked: 42, stats_trackers_blocked: 7 };
    const original = structuredClone(data);
    const migrator = new Migrator({
      async getAll() { return structuredClone(data); },
      async setMultiple(values) { Object.assign(data, structuredClone(values)); },
      async remove(keys) { keys.forEach(key => delete data[key]); },
    }, { verbose: false, targetVersion: 19 });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 19, appliedSteps: [19], backupKey: 'settings_backup_v18' });
    expect(data.settings_backup_v18).toEqual(original);
    expect(data).toMatchObject({ schema_version: 19, ad_stats_widget: false,
      'widget:ad-stats': { mode: 'free', visible: true, order: 0, position: null },
      stats_ads_blocked: 42, stats_trackers_blocked: 7 });
    const first = structuredClone(data);
    expect(await migrator.migrate()).toMatchObject({ migrated: false, appliedSteps: [] });
    expect(data).toEqual(first);
  });
});
