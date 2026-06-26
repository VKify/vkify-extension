import type { StateCreator } from 'zustand';
import { announceAnchor } from '@/popup/utils/pendingAnchor.js';
import type { VKifyState } from '../index.js';

/**
 * UI/навигация верхнего уровня попапа. Раньше жила локальным `useState` в
 * `Layout`. Подстраницы (`SubpageHost`) остаются на локальном состоянии
 * осознанно — они per-host и завязаны на DOM (scroll restore, deep-link).
 */
export interface UiSlice {
  /** Активная вкладка верхнего уровня (id из TABS). */
  activeTab: string;
  /** Открыта ли палитра поиска (Ctrl+K). */
  searchOpen: boolean;
  /** Ожидающий deep-link якорь — Layout его опрашивает в DOM и сбрасывает. */
  pendingAnchor: string | null;

  setActiveTab: (id: string) => void;
  setSearchOpen: (open: boolean) => void;
  setPendingAnchor: (anchor: string | null) => void;
  /** Единая точка навигации: переключить вкладку + поставить якорь для подсветки. */
  navigateTo: (tabId: string, anchorId?: string | null) => void;
}

export const createUiSlice: StateCreator<
  VKifyState,
  [['zustand/devtools', never]],
  [],
  UiSlice
> = (set) => ({
  activeTab: 'appearance',
  searchOpen: false,
  pendingAnchor: null,

  setActiveTab: (id) => set({ activeTab: id }, false, 'ui/setActiveTab'),
  setSearchOpen: (open) => set({ searchOpen: open }, false, 'ui/setSearchOpen'),
  setPendingAnchor: (anchor) => set({ pendingAnchor: anchor }, false, 'ui/setPendingAnchor'),

  navigateTo: (tabId, anchorId = null) => {
    set({ activeTab: tabId, pendingAnchor: anchorId }, false, 'ui/navigateTo');
    // Мост для подстраниц (`SubpageHost`), которые сами открывают нужную
    // подстраницу по якорю — иначе DOM-опрос не нашёл бы скрытый элемент.
    announceAnchor(anchorId);
  },
});
