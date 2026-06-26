import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice.js';
import { createUiSlice, type UiSlice } from './slices/uiSlice.js';
import { createSelectors } from './createSelectors.js';

/**
 * Единый стор попапа (Zustand). Заменяет SettingsContext + локальный UI-state.
 *
 * - Собран из слайсов (settings + ui) — каждый слайс самодостаточен и
 *   типизирован через `StateCreator<VKifyState, …>`.
 * - `devtools` подключается только в dev-сборке (`import.meta.env.DEV`): в
 *   проде middleware превращается в no-op, Redux-DevTools не дёргается.
 * - `persist` НЕ используется намеренно: источник правды — chrome.storage.local,
 *   а стор регидрируется через `initStorageSync()` (см. settingsSlice). persist
 *   дублировал бы запись и конфликтовал с storage-листенером.
 */
export type VKifyState = SettingsSlice & UiSlice;

export const useVKifyStore = create<VKifyState>()(
  devtools(
    (...a) => ({
      ...createSettingsSlice(...a),
      ...createUiSlice(...a),
    }),
    { name: 'VKify Popup', enabled: import.meta.env.DEV },
  ),
);

/** Авто-селекторы: `store.use.settings()`, `store.use.saveSetting()` и т.д. */
export const store = createSelectors(useVKifyStore);
