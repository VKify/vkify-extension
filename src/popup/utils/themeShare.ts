import type { Settings } from '../store/slices/settingsSlice.js';
import { THEME_KEYS, appearanceDefault } from '@/shared/constants/appearance.js';
import { SETTINGS_SCHEMA, isValidSettingValue } from '@/shared/constants/settings-schema.js';
import { parseWallpaperValues } from '@/shared/wallpaper-properties.js';

export interface ShareParam { key: string; value: unknown }

export function collectShareParams(settings: Settings): ShareParam[] {
  return THEME_KEYS.flatMap(key => {
    let value = settings[key];
    if (key === 'web_wallpaper_values') {
      const id = settings.web_wallpaper_id;
      const values = parseWallpaperValues(value);
      value = JSON.stringify(typeof id === 'string' && values[id] ? { [id]: values[id] } : {});
    }
    if (value === undefined || value === null || value === '') return [];
    if (JSON.stringify(value) === JSON.stringify(appearanceDefault(key))) return [];
    if (!isValidSettingValue(key, value, 'theme')) return [];
    if (key === 'custom_background' && /^(?:(?:chrome|moz)-extension:|blob:)/i.test(String(value))) return [];
    return [{ key, value }];
  });
}

export function encodeThemeSettings(settings: Settings): string | null {
  try {
    const params = Object.fromEntries(collectShareParams(settings).map(({ key, value }) => [SETTINGS_SCHEMA[key].short ?? key, value]));
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 2, p: params }));
    const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    // The receiver rejects larger URLs; never copy a link it cannot apply.
    return encoded.length <= 128 * 1024 ? encoded : null;
  } catch { return null; }
}
