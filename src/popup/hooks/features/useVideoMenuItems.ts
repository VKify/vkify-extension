import { useVKifyStore } from '@/popup/store/index.js';
import { useSetting } from '@/popup/store/selectors.js';
import { isVideoMenuSelection, normalizeVideoMenuOrder } from '@/shared/constants/video-menu-items.js';

export function useVideoMenuItems() {
  const save = useVKifyStore(state => state.saveSetting);
  const value = useSetting<unknown>('hidden_video_menu_items');
  const hidden = isVideoMenuSelection(value) ? value : [];
  const order = normalizeVideoMenuOrder(useSetting<unknown>('video_menu_items_order'));
  return {
    hiddenCount: hidden.length,
    order,
    moveItem: (id: string, direction: -1 | 1): void => {
      const index = order.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return;
      const next = [...order];
      [next[index], next[target]] = [next[target], next[index]];
      void save('video_menu_items_order', next);
    },
    resetOrder: (): void => { void save('video_menu_items_order', []); },
    isVisible: (id: string): boolean => !hidden.includes(id),
    setVisible: (id: string, visible: boolean): void => {
      void save('hidden_video_menu_items', visible ? hidden.filter(item => item !== id) : hidden.includes(id) ? hidden : [...hidden, id]);
    },
    showAll: (): void => { void save('hidden_video_menu_items', []); },
  };
}
