import { useCallback } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';

/**
 * Управление видимостью пунктов левого меню ВК. Источник истины —
 * `hidden_menu_items` (массив id скрытых пунктов). «Видимый» = id НЕ в списке,
 * поэтому новые пункты ВК показываются по умолчанию.
 */
export function useMenuItems() {
  const saveSetting = useVKifyStore((s) => s.saveSetting);

  const hidden: string[] = useSetting<string[] | undefined>('hidden_menu_items') ?? [];
  const hiddenSet = new Set(hidden);

  const isVisible = useCallback((id: string): boolean => !hiddenSet.has(id), [hiddenSet]);

  const setVisible = useCallback((id: string, visible: boolean): void => {
    const next = visible
      ? hidden.filter((x) => x !== id)
      : hiddenSet.has(id) ? hidden : [...hidden, id];
    void saveSetting('hidden_menu_items', next);
  }, [hidden, hiddenSet, saveSetting]);

  const showAll = useCallback((): void => {
    void saveSetting('hidden_menu_items', []);
  }, [saveSetting]);

  return { hidden, hiddenSet, isVisible, setVisible, showAll, hiddenCount: hidden.length };
}
