import { describe, expect, it } from 'vitest';
import { migrateV34ToV35 } from './migrate_v34_to_v35.js';

describe('v35 messenger actions hiding', () => {
  it('defaults to visible and preserves individual hiding settings', () => {
    const old = { hide_channels_tab: true, appearance_profiles: [{ settings: { hide_business_notifications: true } }, null] };
    const next = migrateV34ToV35.migrate(old);
    expect(next).toEqual({ ...old, hide_messenger_actions: false,
      appearance_profiles: [{ settings: { hide_business_notifications: true, hide_messenger_actions: false } }, null] });
    expect(old.appearance_profiles[0]?.settings).not.toHaveProperty('hide_messenger_actions');
    expect(migrateV34ToV35.migrate(next)).toEqual(next);
  });
  it('preserves valid imported settings and rejects non-booleans', () => {
    expect(migrateV34ToV35.migrate({ hide_messenger_actions: true })).toEqual({ hide_messenger_actions: true });
    expect(migrateV34ToV35.migrate({ hide_messenger_actions: 'true' })).toEqual({ hide_messenger_actions: false });
  });
});
