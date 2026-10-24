import type { Migration, RawSettings } from './types.js';

// Freeze v36 defaults and validation so later appearance changes cannot alter
// upgrades from this version. Existing custom choices and menu modes survive.
function initializeEdgeAppearance(settings: RawSettings): RawSettings {
  const number = (key: string, fallback: number, min: number, max: number): number => {
    const value = settings[key];
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
      ? value : fallback;
  };
  const background = settings.edge_sidebar_background;
  const color = settings.edge_sidebar_color;
  return {
    ...settings,
    edge_sidebar_width: settings.edge_sidebar_width === 0 ? 0 : number('edge_sidebar_width', 0, 156, 300),
    edge_sidebar_background: background === 'theme' || background === 'custom' || background === 'transparent' ? background : 'theme',
    edge_sidebar_color: typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : '#1f2937',
    edge_sidebar_opacity: number('edge_sidebar_opacity', 100, 0, 100),
    edge_sidebar_blur: number('edge_sidebar_blur', 0, 0, 40),
    edge_sidebar_item_radius: number('edge_sidebar_item_radius', 8, 0, 24),
    edge_sidebar_item_height: number('edge_sidebar_item_height', 38, 32, 56),
  };
}

export const migrateV35ToV36: Migration = {
  to: 36,
  description: 'Initialize edge sidebar appearance for settings and saved profiles',
  migrate: old => ({
    ...initializeEdgeAppearance(old),
    ...(Array.isArray(old.appearance_profiles) ? {
      appearance_profiles: old.appearance_profiles.map(profile => {
        if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return profile;
        if (!profile.settings || typeof profile.settings !== 'object' || Array.isArray(profile.settings)) return profile;
        return { ...profile, settings: initializeEdgeAppearance(profile.settings) };
      }),
    } : {}),
  }),
};
