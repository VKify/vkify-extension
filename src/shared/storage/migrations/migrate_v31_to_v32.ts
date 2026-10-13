import type { Migration, RawSettings } from './types.js';

function initializeMenu(settings: RawSettings): RawSettings {
  return {
    ...settings,
    tile_sidebar: settings.tile_sidebar === true,
    ...(settings.tile_sidebar === true ? { minimalistic_sidebar: false } : {}),
  };
}

export const migrateV31ToV32: Migration = {
  to: 32,
  description: 'Add tile sidebar mode while preserving the existing menu layout',
  migrate: old => ({
    ...initializeMenu(old),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
        if (!profile.settings || typeof profile.settings !== 'object' || Array.isArray(profile.settings)) return profile;
        return { ...profile, settings: initializeMenu(profile.settings) };
      }),
    } : {}),
  }),
};
