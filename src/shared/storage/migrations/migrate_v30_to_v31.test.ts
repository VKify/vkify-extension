import { describe, expect, it } from 'vitest';
import { migrateV30ToV31 } from './migrate_v30_to_v31.js';

describe('v31 header modes', () => {
  it('keeps native or static behavior and initializes saved profiles without mutation', () => {
    const old = { static_header: true, appearance_profiles: [{ id: 'one', settings: { static_header: true } }, null] };
    const before = structuredClone(old);
    const next = migrateV30ToV31.migrate(old);
    expect(next).toEqual({ ...old, auto_hide_header: false, compact_header: false,
      appearance_profiles: [{ id: 'one', settings: { static_header: true, auto_hide_header: false, compact_header: false } }, null] });
    expect(old).toEqual(before);
    expect(migrateV30ToV31.migrate(next)).toEqual(next);
  });
  it('preserves selected modes and resolves conflicting flags in favor of static mode', () => {
    expect(migrateV30ToV31.migrate({ auto_hide_header: true, compact_header: true }))
      .toEqual({ auto_hide_header: true, compact_header: true });
    expect(migrateV30ToV31.migrate({ static_header: true, auto_hide_header: true, compact_header: true }))
      .toEqual({ static_header: true, auto_hide_header: false, compact_header: true });
    expect(migrateV30ToV31.migrate({ auto_hide_header: 'true', compact_header: 1 }))
      .toEqual({ auto_hide_header: false, compact_header: false });
  });
});
