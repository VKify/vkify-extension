import type { Migration, RawSettings } from './types.js';

function initializeActions(settings: RawSettings): RawSettings {
  return { ...settings, hide_messenger_actions: settings.hide_messenger_actions === true };
}

export const migrateV34ToV35: Migration = {
  to: 35,
  description: 'Initialize messenger actions hiding for settings and appearance profiles',
  migrate: old => ({ ...initializeActions(old),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
        if (!profile.settings || typeof profile.settings !== 'object' || Array.isArray(profile.settings)) return profile;
        return { ...profile, settings: initializeActions(profile.settings) };
      }),
    } : {}),
  }),
};
