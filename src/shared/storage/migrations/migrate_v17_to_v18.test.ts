import { describe, expect, it } from 'vitest';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';
import { migrateV17ToV18 } from './migrate_v17_to_v18.js';

describe('v18 VK Video widget visibility', () => {
  it('preserves stack preferences and unrelated settings without mutation', () => {
    const stack = Object.freeze({ side: 'left', collapsed: true, position: { left: 20, top: 40 } });
    const old = Object.freeze({ widgetStack: stack, 'widget:clock': { visible: false }, custom_font: 'Existing' });
    expect(migrateV17ToV18.migrate(old)).toEqual({ ...old, widgetStack: { ...stack, showOnVkVideo: true } });
    expect(stack).not.toHaveProperty('showOnVkVideo');
  });

  it.each([undefined, null, [], 'invalid'])('initializes missing or damaged stack settings (%j)', widgetStack => {
    expect(migrateV17ToV18.migrate({ widgetStack }).widgetStack).toEqual({ showOnVkVideo: true });
  });

  it.each([true, false])('preserves the saved visibility choice %s and is idempotent', showOnVkVideo => {
    const old = { widgetStack: { showOnVkVideo, width: 400 } };
    const next = migrateV17ToV18.migrate(old);
    expect(next).toEqual(old);
    expect(migrateV17ToV18.migrate(next)).toEqual(next);
  });

  it('backs up v17 through the registry and runs only once', async () => {
    const data: RawSettings = { schema_version: 17, widgetStack: { width: 400 } };
    const original = structuredClone(data);
    const migrator = new Migrator({
      async getAll() { return structuredClone(data); },
      async setMultiple(values) { Object.assign(data, structuredClone(values)); },
      async remove(keys) { keys.forEach(key => delete data[key]); },
    }, { verbose: false, targetVersion: 18 });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 18, appliedSteps: [18], backupKey: 'settings_backup_v17' });
    expect(data.settings_backup_v17).toEqual(original);
    expect(data).toMatchObject({ schema_version: 18, widgetStack: { width: 400, showOnVkVideo: true } });
    const first = structuredClone(data);
    expect(await migrator.migrate()).toMatchObject({ migrated: false, appliedSteps: [] });
    expect(data).toEqual(first);
  });
});
