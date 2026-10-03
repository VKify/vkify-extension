import { describe, expect, it } from 'vitest';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';
import { migrateV15ToV16 } from './migrate_v15_to_v16.js';
import { validAutoAddOptions } from '../../auto-add-friends.js';

describe('v16 Center API migration', () => {
  it('disables legacy automation, keeps success counts and bounds old limits without starting', () => {
    const stats = Object.freeze({ isRunning: true, added: 42, nextAt: 123 });
    const old = Object.freeze({ auto_add_friends: true, auto_add_limit: 100, auto_add_delay_min: 10, auto_add_delay_max: 20, auto_add_stats: stats, custom_font: 'Existing' });
    const next = migrateV15ToV16.migrate(old);
    expect(next).toMatchObject({ auto_add_friends: false, custom_font: 'Existing', auto_add_stats: {
      isRunning: false, inFlight: false, added: 42, attempted: 0, reason: 'interrupted',
      options: { hour: 20, day: 25, session: 10, delayMin: 30, delayMax: 30 }, source: { kind: 'recommendations' },
    } });
    expect((next.auto_add_stats as RawSettings).nextAt).toBeUndefined();
    expect(stats.nextAt).toBe(123);
    expect(old.auto_add_friends).toBe(true);
    expect(migrateV15ToV16.migrate(next)).toEqual(next);
  });

  it.each([
    { auto_add_limit: -5, auto_add_delay_min: 900, auto_add_delay_max: 35 },
    { auto_add_limit: '50', auto_add_delay_min: NaN, auto_add_delay_max: Infinity },
    { auto_add_limit: 10.8, auto_add_delay_min: 30.7, auto_add_delay_max: 55.9 },
  ])('produces valid API options for legacy settings %j', settings => {
    const next = migrateV15ToV16.migrate(settings);
    expect(validAutoAddOptions((next.auto_add_stats as RawSettings).options)).toBe(true);
  });

  it('preserves existing API jobs, uploaded lists, member results and both account budgets', () => {
    const old = Object.freeze({
      auto_add_friends: false,
      auto_add_stats: { isRunning: true, options: { hour: 8, day: 15, session: 5, delayMin: 60, delayMax: 90 }, source: { kind: 'list', ids: [2, 3], ownerId: '1' }, attempted: 2, added: 1, userId: '1', cursor: 2 },
      auto_add_ledger: { '1': [{ at: 123, id: 2 }] },
      group_parser_state: { status: 'stopped', userId: '1', ids: [2, 3], group: { id: 100, name: 'Community' } },
      group_parser_ledger: { '1': [123] }, token: 'existing', message_templates: ['custom'],
    });
    expect(migrateV15ToV16.migrate(old)).toEqual(old);
  });

  it('does not seed synthetic jobs or replace an unrecognized runtime record', () => {
    expect(migrateV15ToV16.migrate({})).toEqual({ auto_add_friends: false });
    expect(migrateV15ToV16.migrate({ auto_add_stats: 'unknown' }).auto_add_stats).toBe('unknown');
  });

  it('backs up schema 15 through the real registry and does nothing on the next startup', async () => {
    const data: RawSettings = { schema_version: 15, auto_add_friends: true, auto_add_limit: 50, group_parser_state: { status: 'error', ids: [5] } };
    const original = structuredClone(data);
    const migrator = new Migrator({
      async getAll() { return structuredClone(data); },
      async setMultiple(values) { Object.assign(data, structuredClone(values)); },
      async remove(keys) { keys.forEach(key => delete data[key]); },
    }, { verbose: false, targetVersion: 16 });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 16, appliedSteps: [16], backupKey: 'settings_backup_v15' });
    expect(data.settings_backup_v15).toEqual(original);
    expect(data).toMatchObject({ schema_version: 16, auto_add_friends: false, group_parser_state: original.group_parser_state });
    const first = structuredClone(data);
    expect(await migrator.migrate()).toMatchObject({ migrated: false, appliedSteps: [] });
    expect(data).toEqual(first);
  });
});
