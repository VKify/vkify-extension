import type { Migration, RawSettings } from './types.js';

function initializeFilters(settings: RawSettings): RawSettings {
  return { ...settings, hide_messenger_filters: settings.hide_messenger_filters === true };
}

export const migrateV33ToV34: Migration = {
  to: 34,
  description: 'Initialize messenger filters hiding for settings and appearance profiles',
  migrate: old => ({ ...initializeFilters(old),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
        if (!profile.settings || typeof profile.settings !== 'object' || Array.isArray(profile.settings)) return profile;
        return { ...profile, settings: initializeFilters(profile.settings) };
      }),
    } : {}),
  }),
};
