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
