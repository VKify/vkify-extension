import type { Migration, RawSettings } from './types.js';

function initializeStaticHeader(settings: RawSettings): RawSettings {
  return {
    ...settings,
    static_header: typeof settings.static_header === 'boolean' ? settings.static_header : false,
  };
}

export const migrateV29ToV30: Migration = {
  to: 30,
  description: 'Initialize the optional static header setting and saved appearance profiles',
  migrate: old => ({
    ...initializeStaticHeader(old),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
        const settings = profile.settings;
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return profile;
        return { ...profile, settings: initializeStaticHeader(settings) };
      }),
    } : {}),
  }),
};
