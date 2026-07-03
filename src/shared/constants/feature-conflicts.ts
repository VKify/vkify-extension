/**
 * ЕДИНЫЙ ИСТОЧНИК ИСТИНЫ о конфликтующих фичах.
 *
 * Лежит в shared, потому что список нужен ДВУМ мирам, которые не могут
 * импортировать друг друга:
 *   • popup — предупреждает пользователя в момент включения тумблера
 *     (см. popup/utils/conflicts.ts);
 *   • content — FeatureRegistry кладёт conflictsWith в метадату, а
 *     FeatureManager пишет console.warn + событие 'feature:conflict' при
 *     активации второй фичи пары.
 *
 * У FeatureDefinition НЕТ поля conflictsWith — намеренно: два источника с
 * merge-логикой быстро расходятся. Добавление конфликта = одна запись здесь.
 *
 * Конфликт — это «обе фичи работают, но вместе дают бессмысленный/ломанный
 * результат». Взаимодополняющие фичи (напр. block_feed_ads_api +
 * block_feed_ads_dom — два эшелона одной защиты) конфликтом НЕ являются.
 */

export interface FeatureConflict {
  /** id первой фичи пары (ключ настроек). */
  readonly a: string;
  /** id второй фичи пары. */
  readonly b: string;
  /** Человекочитаемая причина (RU) — показывается в попапе и в console.warn. */
  readonly reason: string;
}

export const FEATURE_CONFLICTS: readonly FeatureConflict[] = [
  {
    a: 'filter_high_contrast',
    b: 'filter_low_brightness',
    reason: 'противоположные фильтры яркости — вместе дают непредсказуемую картинку',
  },
  {
    a: 'filter_grayscale',
    b: 'filter_sepia',
    reason: 'оба перекрашивают всю страницу целиком — эффекты перекрывают друг друга',
  },
  {
    a: 'filter_invert',
    b: 'custom_theme',
    reason: 'инверсия цветов ломает палитру пользовательской темы',
  },
];

/** Прекомпилированный индекс: id фичи → конфликты, где она участвует. */
export const CONFLICTS_BY_ID: Readonly<Record<string, readonly FeatureConflict[]>> = (() => {
  const map: Record<string, FeatureConflict[]> = {};
  for (const conflict of FEATURE_CONFLICTS) {
    (map[conflict.a] ??= []).push(conflict);
    (map[conflict.b] ??= []).push(conflict);
  }
  return map;
})();

/** Конфликты, в которых участвует фича `id` (пустой массив, если нет). */
export function conflictsFor(id: string): readonly FeatureConflict[] {
  return CONFLICTS_BY_ID[id] ?? [];
}

/** id «другой стороны» конфликта относительно фичи `id`. */
export function otherSide(conflict: FeatureConflict, id: string): string {
  return conflict.a === id ? conflict.b : conflict.a;
}

/** Конфликт между конкретной парой фич (в любом порядке), если объявлен. */
export function findConflict(a: string, b: string): FeatureConflict | undefined {
  return FEATURE_CONFLICTS.find(
    (c) => (c.a === a && c.b === b) || (c.a === b && c.b === a),
  );
}
