import type { Migration } from './types.js';
import { parseLogoColorMode } from '../../custom-logo.js';

export const migrateV28ToV29: Migration = {
  to: 29,
  description: 'Remove the text color mode for custom header logos',
  migrate: old => ({
    ...old,
    custom_logo_color_mode: parseLogoColorMode(old.custom_logo_color_mode),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || profile.settings?.custom_logo_color_mode !== 'text') return profile;
        return { ...profile, settings: { ...profile.settings, custom_logo_color_mode: 'original' } };
      }),
    } : {}),
  }),
};
