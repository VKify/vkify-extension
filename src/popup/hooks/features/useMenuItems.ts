import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext.js';

/**
 * Управление видимостью пунктов левого меню ВК. Источник истины —
 * `hidden_menu_items` (массив id скрытых пунктов). «Видимый» = id НЕ в списке,
 * поэтому новые пункты ВК показываются по умолчанию.
 */
export function useMenuItems() {
  const { settings, saveSetting } = useSettings();

  const hidden: string[] = (settings['hidden_menu_items'] as string[] | undefined) ?? [];
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
