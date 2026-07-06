/** Форматтеры для Performance Dashboard. */

import i18n from '@/popup/i18n.js';
import type { FeatureImpact } from '@/shared/constants/perf.js';

export function formatBytes(bytes?: number): string {
  if (bytes == null || bytes <= 0) return i18n.t('perf:format.na');
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return i18n.t('perf:format.mb', { value: mb.toFixed(1) });
  return i18n.t('perf:format.kb', { value: Math.round(bytes / 1024) });
}

export function formatMs(ms: number): string {
  if (ms <= 0) return i18n.t('perf:format.msZero');
  if (ms < 1) return i18n.t('perf:format.msSub');
  if (ms < 1000) return i18n.t('perf:format.ms', { value: Math.round(ms) });
  return i18n.t('perf:format.sec', { value: (ms / 1000).toFixed(2) });
}

/** Tailwind-классы бейджа impact — читаемы в обеих темах. */
export const IMPACT_BADGE: Record<FeatureImpact, string> = {
  light:  'bg-green-500/15 text-green-600',
  medium: 'bg-amber-500/15 text-amber-600',
  heavy:  'bg-red-500/15 text-red-600',
};

/** Локализованная подпись веса фичи (impact). */
export function impactLabel(impact: FeatureImpact): string {
  return i18n.t(`perf:impact.${impact}`);
}

/** Порядок сортировки фич: тяжёлые сверху. */
export const IMPACT_ORDER: Record<FeatureImpact, number> = {
  heavy: 0,
  medium: 1,
  light: 2,
};

/**
 * Человекочитаемое название категории реестра (FeatureCategory). Неизвестная
 * категория рендерится как есть (defaultValue = сам ключ).
 */
export function categoryLabel(category: string): string {
  return i18n.t(`perf:category.${category}`, { defaultValue: category });
}
