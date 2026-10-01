import { useCallback } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';
import { normalizeMenuOrder } from '@/shared/constants/menu-items.js';

/**
 * Управление видимостью пунктов левого меню ВК. Источник истины —
 * `hidden_menu_items` (массив id скрытых пунктов). «Видимый» = id НЕ в списке,
 * поэтому новые пункты ВК показываются по умолчанию.
 */
export function useMenuItems() {
  const saveSetting = useVKifyStore((s) => s.saveSetting);

  const hidden: string[] = useSetting<string[] | undefined>('hidden_menu_items') ?? [];
  const hiddenSet = new Set(hidden);
  const savedOrder = useSetting<string[] | undefined>('menu_items_order');
  const order = normalizeMenuOrder(savedOrder);
  const moveItem = (id: string, direction: -1 | 1): void => {
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    void saveSetting('menu_items_order', next);
  };
  const resetOrder = (): void => { void saveSetting('menu_items_order', []); };

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

  return { hidden, hiddenSet, isVisible, setVisible, showAll, hiddenCount: hidden.length, order, moveItem, resetOrder };
}
