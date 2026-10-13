import { describe, expect, it } from 'vitest';
import { migrateV31ToV32 } from './migrate_v31_to_v32.js';

describe('v32 tile sidebar', () => {
  it('preserves existing layouts and initializes saved profiles without mutating them', () => {
    const old = { minimalistic_sidebar: true, appearance_profiles: [{ id: 'mini', settings: { minimalistic_sidebar: true } }, null] };
    const next = migrateV31ToV32.migrate(old);
    expect(next).toEqual({ minimalistic_sidebar: true, tile_sidebar: false,
      appearance_profiles: [{ id: 'mini', settings: { minimalistic_sidebar: true, tile_sidebar: false } }, null] });
    expect(old.appearance_profiles[0]?.settings).not.toHaveProperty('tile_sidebar');
    expect(migrateV31ToV32.migrate(next)).toEqual(next);
  });

  it('gives tiles precedence over conflicting imported flags and rejects non-booleans', () => {
    expect(migrateV31ToV32.migrate({ tile_sidebar: true, minimalistic_sidebar: true })).toEqual({ tile_sidebar: true, minimalistic_sidebar: false });
    expect(migrateV31ToV32.migrate({ tile_sidebar: 'true' })).toEqual({ tile_sidebar: false });
  });
});
