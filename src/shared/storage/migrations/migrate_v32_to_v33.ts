import type { Migration, RawSettings } from './types.js';

function initializeMenu(settings: RawSettings): RawSettings {
  return { ...settings, edge_sidebar: settings.edge_sidebar === true,
    ...(settings.edge_sidebar === true ? { tile_sidebar: false, minimalistic_sidebar: false } : {}) };
}

export const migrateV32ToV33: Migration = {
  to: 33,
  description: 'Initialize edge sidebar mode without changing existing menu preferences',
  migrate: old => ({ ...initializeMenu(old),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
        if (!profile.settings || typeof profile.settings !== 'object' || Array.isArray(profile.settings)) return profile;
        return { ...profile, settings: initializeMenu(profile.settings) };
      }),
    } : {}),
  }),
};
