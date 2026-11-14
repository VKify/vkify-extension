import { isBackgroundSource } from '@/shared/background-source.js';
import type { Settings } from '../store/slices/settingsSlice.js';
import { THEME_KEYS, appearanceDefault } from '@/shared/constants/appearance.js';
import { SETTINGS_SCHEMA, isValidSettingValue } from '@/shared/constants/settings-schema.js';

export interface ShareParam { key: string; value: unknown }

/** Keep uploaded file bytes out of bounded theme URLs. */
export function hasLocalThemeBackground(settings: Settings): boolean {
  return !isBackgroundSource(settings.background_source_url) && typeof settings.custom_background === 'string'
    && /^(?:data:|blob:|(?:chrome|moz)-extension:)/i.test(settings.custom_background);
}

export function collectShareParams(settings: Settings): ShareParam[] {
  return THEME_KEYS.flatMap(key => {
    // custom_background already carries the source URL in shared themes.
    if (key === 'background_source_url') return [];
    let value = key === 'custom_background' && isBackgroundSource(settings.background_source_url) ? settings.background_source_url : settings[key];
    if (value === undefined || value === null || value === '') return [];
    if (JSON.stringify(value) === JSON.stringify(appearanceDefault(key))) return [];
    if (!isValidSettingValue(key, value, 'theme')) return [];
    if (key === 'custom_background' && typeof value === 'string' && /^(?:data:|blob:|(?:chrome|moz)-extension:)/i.test(value)) return [];
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
