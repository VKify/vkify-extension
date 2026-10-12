import { describe, expect, it } from 'vitest';
import { migrateV28ToV29 } from './migrate_v28_to_v29.js';

describe('v29 removes the logo text color mode', () => {
  it('restores original colors in settings and saved profiles without changing the image', () => {
    const old = { custom_logo_color_mode: 'text', custom_logo: 'https://example.com/logo.png', custom_logo_color: '#123456',
      appearance_profiles: [{ id: 'one', settings: { custom_logo_color_mode: 'text', custom_logo: 'https://example.com/logo.svg' } }], unrelated: 42 };
    const before = structuredClone(old);
    const next = migrateV28ToV29.migrate(old);
    expect(next).toMatchObject({ ...old, custom_logo_color_mode: 'original',
      appearance_profiles: [{ id: 'one', settings: { ...old.appearance_profiles[0].settings, custom_logo_color_mode: 'original' } }] });
    expect(old).toEqual(before);
    expect(migrateV28ToV29.migrate(next)).toEqual(next);
  });
  it.each(['original', 'theme', 'custom'])('preserves the %s mode', mode => {
    expect(migrateV28ToV29.migrate({ custom_logo_color_mode: mode, custom_logo_color: '#123456' }))
      .toEqual({ custom_logo_color_mode: mode, custom_logo_color: '#123456' });
  });
});
