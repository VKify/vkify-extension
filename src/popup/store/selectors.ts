import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useVKifyStore } from './index.js';

/**
 * Типобезопасные computed-селекторы поверх стора. Возвращающие массивы/объекты
 * обёрнуты в `useShallow`, чтобы компонент ре-рендерился только при реальном
 * изменении набора, а не на каждый `set` стора.
 */

/** Значение одной настройки по ключу (узкая подписка — без ре-рендера на чужих ключах). */
export function useSetting<T = unknown>(key: string): T {
  return useVKifyStore((s) => s.settings[key] as T);
}

/** Включена ли фича (булев флаг настройки). */
export function useFeatureEnabled(id: string): boolean {
  return useVKifyStore((s) => !!s.settings[id]);
}

/** Из переданного списка id — те, что сейчас включены в настройках. */
export function useEnabledFeatureIds(ids: readonly string[]): string[] {
  return useVKifyStore(useShallow((s) => ids.filter((id) => !!s.settings[id])));
}

/** Минимум метадаты фичи, нужный для группировки по весу (id + impact). */
export interface FeatureLike {
  id: string;
  impact: string;
}

/** Результат `useFeaturesByImpact`. */
export interface FeaturesByImpact {
  /** Все id фич этого веса (из метадаты реестра). */
  ids: string[];
  /** Подмножество, включённое сейчас в настройках. */
  enabledIds: string[];
  /** Сколько включено (= `enabledIds.length`). */
  enabledCount: number;
}

/**
 * Удобный computed-селектор для дашборда/explorer'а: из метадаты реестра
 * (`entries`, обычно `summary.features`) берёт фичи заданного веса и
 * подмешивает их актуальное вкл/выкл-состояние из стора (через
 * `useEnabledFeatureIds` с shallow-сравнением). `impact` не типизирован
 * union'ом намеренно — store не зависит от perf-типов контент-слоя.
 */
export function useFeaturesByImpact(
  entries: readonly FeatureLike[],
  impact: string,
): FeaturesByImpact {
  const ids = useMemo(
    () => entries.filter((e) => e.impact === impact).map((e) => e.id),
    [entries, impact],
  );
  const enabledIds = useEnabledFeatureIds(ids);
  return { ids, enabledIds, enabledCount: enabledIds.length };
}
