import type { Migration, RawSettings } from './types.js';

function initializeHeaderModes(settings: RawSettings): RawSettings {
  return {
    ...settings,
    // Static mode takes precedence if an old/imported snapshot has both flags.
    auto_hide_header: settings.static_header !== true && settings.auto_hide_header === true,
    compact_header: settings.compact_header === true,
  };
}

export const migrateV30ToV31: Migration = {
  to: 31,
  description: 'Initialize scroll-aware and compact header settings without changing existing header behavior',
  migrate: old => ({
    ...initializeHeaderModes(old),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
        const settings = profile.settings;
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return profile;
        return { ...profile, settings: initializeHeaderModes(settings) };
      }),
    } : {}),
  }),
};
