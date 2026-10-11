import type { Migration } from './types.js';
import { DEFAULT_BLOCK_RADIUS } from '../../constants/theme-radius.js';

/** Zero previously meant native VK rounding rather than square corners. */
export const migrateV25ToV26: Migration = {
  to: 26,
  description: 'Use the native 12px block radius as the default',
  migrate: old => ({
    ...old,
    theme_radius: old.theme_radius === 0 || old.theme_radius == null ? DEFAULT_BLOCK_RADIUS : old.theme_radius,
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || profile.settings?.theme_radius !== 0) return profile;
        return { ...profile, settings: { ...profile.settings, theme_radius: DEFAULT_BLOCK_RADIUS } };
      }),
    } : {}),
  }),
};
