import { describe, expect, it } from 'vitest';
import { migrateV33ToV34 } from './migrate_v33_to_v34.js';

describe('v34 messenger filters hiding', () => {
  it('defaults to visible and preserves individual hiding settings', () => {
    const old = { hide_channels_tab: true, appearance_profiles: [{ settings: { hide_business_notifications: true } }, null] };
    const next = migrateV33ToV34.migrate(old);
    expect(next).toEqual({ ...old, hide_messenger_filters: false,
      appearance_profiles: [{ settings: { hide_business_notifications: true, hide_messenger_filters: false } }, null] });
    expect(old.appearance_profiles[0]?.settings).not.toHaveProperty('hide_messenger_filters');
    expect(migrateV33ToV34.migrate(next)).toEqual(next);
  });
  it('preserves valid imported settings and rejects non-booleans', () => {
    expect(migrateV33ToV34.migrate({ hide_messenger_filters: true })).toEqual({ hide_messenger_filters: true });
    expect(migrateV33ToV34.migrate({ hide_messenger_filters: 'true' })).toEqual({ hide_messenger_filters: false });
  });
});
