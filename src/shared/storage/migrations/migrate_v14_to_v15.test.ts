import { describe, expect, it } from 'vitest';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';
import { migrateV14ToV15, V15_FEATURE_DEFAULTS } from './migrate_v14_to_v15.js';

describe('v15 feature backfill', () => {
  it('adds missing preferences without enabling message delivery', () => {
    expect(migrateV14ToV15.migrate({})).toEqual(V15_FEATURE_DEFAULTS);
    expect(V15_FEATURE_DEFAULTS.telegram_messages_enabled).toBe(false);
  });

  it('preserves every existing preference and unrelated user data, without mutation', () => {
    const old = Object.freeze({
      ...Object.fromEntries(Object.keys(V15_FEATURE_DEFAULTS).map(key => [key, false])),
      telegram_bot_token: '123:existing', telegram_chat_id: '-100123',
      mini_player_width: 700, mini_player_hotkey: '', telegram_dedupe_ttl_seconds: 0,
      music_lyrics_settings: '{"opacity":42}', clock_settings: '{"seconds":true}',
      'widget:clock': { visible: false, position: { left: 4, top: 9 } },
      message_templates: [{ text: 'Custom template' }], profile_spy_log: ['existing'],
    });
    const next = migrateV14ToV15.migrate(old);
    expect(next).toEqual(old);
    expect(next).not.toBe(old);
    expect(migrateV14ToV15.migrate(next)).toEqual(next);
  });

  it('runs through the registered chain, backs up v14 and does nothing on a second start', async () => {
    const data: RawSettings = { schema_version: 14, telegram_notifications_enabled: true, telegram_bot_token: '123:existing', music_mini_player: true };
    const original = { ...data };
    const migrator = new Migrator({
      async getAll() { return { ...data }; },
      async setMultiple(values) { Object.assign(data, values); },
      async remove(keys) { keys.forEach(key => delete data[key]); },
    }, { verbose: false });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 15, appliedSteps: [15], backupKey: 'settings_backup_v14' });
    expect(data.settings_backup_v14).toEqual(original);
    expect(data).toMatchObject({ schema_version: 15, music_mini_player: true, telegram_notifications_enabled: true, telegram_bot_token: '123:existing', telegram_spy_online_enabled: true, telegram_messages_enabled: false });
    const first = { ...data };
    expect(await migrator.migrate()).toMatchObject({ migrated: false, appliedSteps: [] });
    expect(data).toEqual(first);
  });
});
