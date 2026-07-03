/**
 * Popup-сторона feature intelligence: предупреждения о конфликтующих фичах.
 * Источник пар — shared/constants/feature-conflicts.ts (тот же, по которому
 * content-скрипт пишет console.warn и событие feature:conflict).
 */

import { CONFLICTS_BY_ID, conflictsFor, otherSide } from '@/shared/constants/feature-conflicts.js';
import { FUNCTIONS } from '../constants/functions.js';
import type { Settings } from '../store/slices/settingsSlice.js';

/** id всех фич, участвующих хоть в одном конфликте (для дешёвого диффа). */
export const CONFLICTING_IDS: readonly string[] = Object.keys(CONFLICTS_BY_ID);

/**
 * «Включено» в смысле активации фичи (зеркалит content/core/should-enable.ts:
 * true / положительное число / непустая строка / непустой массив).
 */
export function isFeatureOn(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'number' && value > 0) return true;
  if (typeof value === 'string' && value !== '') return true;
  if (Array.isArray(value) && value.length > 0) return true;
  return false;
}

/**
 * «Выключенное» значение для настройки — по её текущему типу (парно к
 * isFeatureOn): boolean → false, число → 0, строка → '', массив → [].
 */
export function offValueFor(currentValue: unknown): unknown {
  if (typeof currentValue === 'number') return 0;
  if (typeof currentValue === 'string') return '';
  if (Array.isArray(currentValue)) return [];
  return false;
}

export interface PendingConflict {
  /** id «другой стороны» конфликта. */
  readonly with: string;
  readonly reason: string;
}

/**
 * Конфликты, которые СТАНУТ активны, если включить `key` при текущих настройках
 * (другая сторона пары уже включена). Пустой массив — включать безопасно.
 */
export function pendingConflicts(key: string, settings: Settings): PendingConflict[] {
  return conflictsFor(key)
    .map((c) => ({ with: otherSide(c, key), reason: c.reason }))
    .filter((p) => isFeatureOn(settings[p.with]));
}

/** Человекочитаемые имена фич из конфликтных пар, отсутствующих в FUNCTIONS. */
const EXTRA_TITLES: Record<string, string> = {
  filter_grayscale: 'Чёрно-белый',
  filter_sepia: 'Сепия',
  filter_invert: 'Инверсия цветов',
  filter_dim_images: 'Затемнить изображения',
  filter_high_contrast: 'Высокий контраст',
  filter_low_brightness: 'Пониженная яркость',
  custom_theme: 'Тема оформления',
};

/** Название фичи для сообщения пользователю (FUNCTIONS → локальная карта → id). */
export function featureTitle(id: string): string {
  return FUNCTIONS.find((f) => f.id === id)?.title ?? EXTRA_TITLES[id] ?? id;
}
