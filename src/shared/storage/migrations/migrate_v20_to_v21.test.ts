import { describe, expect, it } from 'vitest';
import { Migrator } from '../Migrator.js';
import type { RawSettings } from './types.js';
import { migrateV20ToV21 } from './migrate_v20_to_v21.js';

describe('v21 widget appearance and auto-hide', () => {
  it('adds opt-in defaults without mutating existing positions, visibility or unrelated settings', () => {
    const stack = Object.freeze({ width: 400, opacity: .8, showOnVkVideo: false });
    const widget = Object.freeze({ mode: 'stacked', visible: false, order: 3, position: { left: 20, top: 40 } });
    const old = Object.freeze({ widgetStack: stack, 'widget:clock': widget, custom_font: 'Existing' });
    const next = migrateV20ToV21.migrate(old);
    expect(next).toEqual({ ...old,
      widgetStack: { ...stack, glass: false, glassBlur: 24, glassOpacity: .58 },
      'widget:clock': { ...widget, hideHeader: false, autoHide: false },
    });
    expect(stack).not.toHaveProperty('glass');
    expect(widget).not.toHaveProperty('autoHide');
    expect(migrateV20ToV21.migrate(next)).toEqual(next);
  });

  it('preserves configured values and handles registered custom widgets', () => {
    const old = { widgetStack: { glass: true, glassBlur: 0, glassOpacity: 0, gap: 32 },
      'widget:custom': { hideHeader: true, autoHide: true, customValue: 42 },
      'widgetDefinition:custom': { title: 'Custom widget' },
    };
    expect(migrateV20ToV21.migrate(old)).toEqual(old);
    expect(migrateV20ToV21.migrate({ widgetStack: { glass: false, glassBlur: 60, glassOpacity: 1 } }).widgetStack)
      .toEqual({ glass: false, glassBlur: 60, glassOpacity: 1 });
  });

  it.each([undefined, null, [], 'invalid'])('initializes missing or damaged records (%j)', value => {
    expect(migrateV20ToV21.migrate({ widgetStack: value, 'widget:clock': value })).toEqual({
      widgetStack: { glass: false, glassBlur: 24, glassOpacity: .58 },
      'widget:clock': { hideHeader: false, autoHide: false },
    });
  });

  it('repairs invalid new fields while preserving other settings', () => {
    expect(migrateV20ToV21.migrate({ widgetStack: { glass: 'true', glassBlur: Infinity, glassOpacity: 2, side: 'left' },
      'widget:clock': { hideHeader: 'true', autoHide: 1, visible: false },
    })).toEqual({ widgetStack: { glass: false, glassBlur: 24, glassOpacity: .58, side: 'left' },
      'widget:clock': { hideHeader: false, autoHide: false, visible: false },
    });
  });

  it('backs up v20 through the registry and runs once', async () => {
    const data: RawSettings = { schema_version: 20, widgetStack: { glass: true }, 'widget:clock': { autoHide: true } };
    const original = structuredClone(data);
    const migrator = new Migrator({
      async getAll() { return structuredClone(data); },
      async setMultiple(values) { Object.assign(data, structuredClone(values)); },
      async remove(keys) { keys.forEach(key => delete data[key]); },
    }, { verbose: false });
    expect(await migrator.migrate()).toMatchObject({ toVersion: 21, appliedSteps: [21], backupKey: 'settings_backup_v20' });
    expect(data.settings_backup_v20).toEqual(original);
    expect(data).toMatchObject({ schema_version: 21, widgetStack: { glass: true, glassBlur: 24, glassOpacity: .58 },
      'widget:clock': { autoHide: true, hideHeader: false },
    });
    const first = structuredClone(data);
    expect(await migrator.migrate()).toMatchObject({ migrated: false, appliedSteps: [] });
    expect(data).toEqual(first);
  });
});
