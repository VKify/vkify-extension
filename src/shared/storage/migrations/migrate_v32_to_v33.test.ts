import { describe, expect, it } from 'vitest';
import { migrateV32ToV33 } from './migrate_v32_to_v33.js';

describe('v33 edge sidebar', () => {
  it('preserves the selected mode and initializes profiles without mutation', () => {
    const old = { tile_sidebar: true, appearance_profiles: [{ settings: { minimalistic_sidebar: true } }, null] };
    const next = migrateV32ToV33.migrate(old);
    expect(next).toEqual({ ...old, edge_sidebar: false, appearance_profiles: [{ settings: { minimalistic_sidebar: true, edge_sidebar: false } }, null] });
    expect(old.appearance_profiles[0]?.settings).not.toHaveProperty('edge_sidebar');
    expect(migrateV32ToV33.migrate(next)).toEqual(next);
  });
  it('gives edge mode precedence over conflicting imports', () => {
    expect(migrateV32ToV33.migrate({ edge_sidebar: true, tile_sidebar: true, minimalistic_sidebar: true }))
      .toEqual({ edge_sidebar: true, tile_sidebar: false, minimalistic_sidebar: false });
    expect(migrateV32ToV33.migrate({ edge_sidebar: 'true' })).toEqual({ edge_sidebar: false });
  });
});
