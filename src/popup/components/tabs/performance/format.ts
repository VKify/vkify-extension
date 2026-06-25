/** Форматтеры для Performance Dashboard. */

export function formatBytes(bytes?: number): string {
  if (bytes == null || bytes <= 0) return 'н/д';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} МБ`;
  return `${Math.round(bytes / 1024)} КБ`;
}

export function formatMs(ms: number): string {
  if (ms <= 0) return '0 мс';
  if (ms < 1) return '<1 мс';
  if (ms < 1000) return `${Math.round(ms)} мс`;
  return `${(ms / 1000).toFixed(2)} с`;
}

import type { FeatureImpact } from '@/shared/constants/perf.js';

/** Tailwind-классы бейджа impact — читаемы в обеих темах. */
export const IMPACT_BADGE: Record<FeatureImpact, string> = {
  light:  'bg-green-500/15 text-green-600',
  medium: 'bg-amber-500/15 text-amber-600',
  heavy:  'bg-red-500/15 text-red-600',
};

export const IMPACT_LABEL: Record<FeatureImpact, string> = {
  light:  'Лёгкая',
  medium: 'Средняя',
  heavy:  'Тяжёлая',
};

/** Порядок сортировки фич: тяжёлые сверху. */
export const IMPACT_ORDER: Record<FeatureImpact, number> = {
  heavy: 0,
  medium: 1,
  light: 2,
};

/** Человекочитаемые названия категорий реестра (FeatureCategory). */
export const CATEGORY_LABEL: Record<string, string> = {
  appearance:    'Оформление',
  elements:      'Элементы',
  feed:          'Лента',
  messages:      'Сообщения',
  media:         'Медиа',
  privacy:       'Приватность',
  ads:           'Реклама',
  spy:           'Слежка',
  automation:    'Автоматизация',
  'custom-css':  'Свой CSS',
  performance:   'Производительность',
  misc:          'Прочее',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}
