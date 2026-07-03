/**
 * Логика применения/выключения встроенных пресетов (BUILTIN_PRESETS).
 *
 * «Видовые» ключи (оформление/скрытие/лэйаут) НЕ перечисляются руками — они
 * деривируются из механизма шаринга тем: scope 'theme' в
 * shared/constants/settings-schema.ts описывает ровно тот набор, который
 * считается «оформлением» (тема, шрифт, фон, фильтры, layout, hide_*).
 * Приватность/automation/spy в этот scope не входят и пресетами с
 * replacesAppearance не затрагиваются.
 */

import { keysForScope } from '@/shared/constants/settings-schema.js';
import { DEFAULT_SETTINGS } from '@/shared/constants/defaults.js';
import type { SettingsPreset } from '@/shared/constants/presets.js';
import { DEFAULTS, CLEAR_VALUES } from './appearanceProfile.js';
import type { Settings } from '../store/slices/settingsSlice.js';

/** Видовые ключи = shareable-набор темы (единый источник — settings-schema). */
const APPEARANCE_SCOPE_KEYS: readonly string[] = keysForScope('theme');

/** «Выключенное»/дефолтное значение видового ключа (как у профилей). */
function appearanceResetValue(key: string): unknown {
  if (key in DEFAULTS) return DEFAULTS[key];
  if (key in CLEAR_VALUES) return CLEAR_VALUES[key];
  return '';
}

/**
 * Дефолтное значение произвольного ключа: сеемые дефолты расширения →
 * дефолты/очистки оформления → false (незаданный булев тумблер выключен).
 */
function defaultValueFor(key: string): unknown {
  if (key in DEFAULT_SETTINGS) return (DEFAULT_SETTINGS as Record<string, unknown>)[key];
  if (key in DEFAULTS) return DEFAULTS[key];
  if (key in CLEAR_VALUES) return CLEAR_VALUES[key];
  return false;
}

/**
 * Патч применения пресета. `replacesAppearance` — сброс ТОЛЬКО видовых ключей
 * (theme-scope) к дефолтам, затем значения пресета; иначе — точечный merge.
 */
export function buildPresetApplyPatch(preset: SettingsPreset): Settings {
  const patch: Settings = {};
  if (preset.replacesAppearance) {
    for (const key of APPEARANCE_SCOPE_KEYS) patch[key] = appearanceResetValue(key);
  }
  return { ...patch, ...preset.settings };
}

/**
 * Патч выключения пресета: все затронутые им ключи возвращаются к дефолтам
 * (не «всё в false» — например, block_trackers по умолчанию включён).
 */
export function buildPresetDisablePatch(preset: SettingsPreset): Settings {
  const keys = preset.replacesAppearance
    ? new Set<string>([...APPEARANCE_SCOPE_KEYS, ...Object.keys(preset.settings)])
    : Object.keys(preset.settings);

  const patch: Settings = {};
  for (const key of keys) patch[key] = defaultValueFor(key);
  return patch;
}

/** Совпадает ли текущее состояние с пресетом (для бейджа «Применён»). */
export function isPresetActive(preset: SettingsPreset, settings: Settings): boolean {
  return Object.entries(preset.settings).every(([key, value]) => {
    const current = settings[key];
    if (current === value) return true;
    // Незаданная настройка эквивалентна «выключенному» значению пресета.
    const isOffValue = value === false || value === 0 || value === '';
    return current === undefined && isOffValue;
  });
}
