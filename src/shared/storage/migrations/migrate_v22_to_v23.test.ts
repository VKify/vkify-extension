import { describe, expect, it } from 'vitest';
import { migrateV22ToV23 } from './migrate_v22_to_v23.js';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';

describe('v23 video hiding', () => {
  it('initializes opt-in settings, preserves preferences and is pure and idempotent', () => {
    const old = Object.freeze({ hide_video_comments: true, block_recommendations_video: false,
      hidden_video_menu_items: ['main_menu_clips', 'sep_video_info'], video_menu_items_order: ['main_menu_clips'], unrelated: 42 });
    const next = migrateV22ToV23.migrate(old);
    expect(next).toMatchObject({ ...old, hide_video_recommendations: false, collapse_video_playlist: false,
      hide_video_categories: false, hide_video_login_prompt: false, hide_video_playlist: false });
    expect(old).not.toHaveProperty('hide_video_categories');
    expect(migrateV22ToV23.migrate(next)).toEqual(next);
  });
  it('repairs invalid preferences without accepting arbitrary menu selectors', () => {
    const next = migrateV22ToV23.migrate({ hide_video_comments: 'true', hidden_video_menu_items: ['body'], video_menu_items_order: ['body'] });
    expect(next.hide_video_comments).toBe(false);
    expect(next.hidden_video_menu_items).toEqual([]);
    expect(next.video_menu_items_order).toEqual([]);
  });
  it('backs up a v22 installation and upgrades through the registered chain once', async () => {
    const data: RawSettings = { schema_version: 22, hide_video_comments: true, hidden_video_menu_items: ['main_menu_movie'] };
    const old = structuredClone(data);
    const migrator = new Migrator({ getAll: async () => structuredClone(data),
      setMultiple: async patch => { Object.assign(data, structuredClone(patch)); },
      remove: async keys => { keys.forEach(key => delete data[key]); } }, { verbose: false });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 23, appliedSteps: [23] });
    expect(data.settings_backup_v22).toEqual(old);
    expect(data.hide_video_comments).toBe(true);
    expect(await migrator.migrate()).toMatchObject({ migrated: false });
  });
});
