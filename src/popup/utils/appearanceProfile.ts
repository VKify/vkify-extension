import type { Settings } from '../store/slices/settingsSlice.js';
import { THEME_KEYS, appearanceDefault } from '@/shared/constants/appearance.js';
export { DEFAULTS, CLEAR_VALUES } from '@/shared/constants/appearance.js';

/** Local profiles also retain CSS, which must never cross the shared-theme boundary. */
export const APPEARANCE_KEYS: readonly string[] = [...THEME_KEYS, 'custom_css', 'custom_css_enabled'];

export interface AppearanceProfile {
  id: string;
  name: string;
  createdAt: number;
  /** Только параметры, отличные от дефолта (результат captureAppearance). */
  settings: Record<string, unknown>;
}

/**
 * Снимок текущего оформления: только параметры, отличные от значений по
 * умолчанию. Тот же фильтр, что и collectShareParams, НО без отбрасывания
 * фонов из файловой системы расширения — локальный профиль их сохраняет.
 */
export function captureAppearance(settings: Settings): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  APPEARANCE_KEYS.forEach(key => {
    const val = settings[key] as unknown;
    if (val === undefined || val === null || val === '') return;
    if (JSON.stringify(val) === JSON.stringify(appearanceDefault(key))) return;
    if (val === false) return;
    out[key] = Array.isArray(val) ? [...val] : val;
  });

  return out;
}

/** Кол-во активных (не-дефолтных) параметров оформления. */
export function countAppearanceParams(settings: Settings): number {
  return Object.keys(captureAppearance(settings)).length;
}

/**
 * Патч для применения профиля: сначала ВСЕ ключи оформления сбрасываются к
 * дефолту/очистке, затем накладываются значения профиля. Так применение —
 * полная замена оформления, без остатков от предыдущего профиля.
 */
export function buildApplyPatch(profileSettings: Record<string, unknown>): Settings {
  const patch: Settings = {};

  APPEARANCE_KEYS.forEach(key => {
    patch[key] = key === 'custom_css_enabled' ? false : appearanceDefault(key);
  });

  for (const key of APPEARANCE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(profileSettings, key)) patch[key] = profileSettings[key];
  }
  return patch;
}

/** Совпадает ли текущее оформление со снимком профиля (для индикатора «активен»). */
export function matchesProfile(current: Settings, profile: AppearanceProfile): boolean {
  const snap = captureAppearance(current);
  const snapKeys = Object.keys(snap);
  const profileKeys = Object.keys(profile.settings);

  if (snapKeys.length !== profileKeys.length) return false;
  // Menu selections are arrays and need comparison by value after a storage reload.
  return snapKeys.every(k => JSON.stringify(snap[k]) === JSON.stringify(profile.settings[k]));
}
