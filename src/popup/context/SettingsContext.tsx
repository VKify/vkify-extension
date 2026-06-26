import React, { useEffect } from 'react';
import { useVKifyStore } from '../store/index.js';
import type { Settings } from '../store/slices/settingsSlice.js';

/**
 * Тонкая обёртка над Zustand-стором (`src/popup/store`).
 *
 * Источником правды для настроек теперь является `useVKifyStore`. Этот модуль
 * сохранён намеренно: `useSettings()` и `SettingsProvider` остаются точкой
 * входа для ~37 потребителей, которые ещё не мигрированы на стор напрямую.
 * Новый код может (и должен) брать узкие селекторы из `../store` —
 * `useSetting()`, `useFeatureEnabled()` и т.п. (см. store/selectors.ts).
 */

// Re-export для обратной совместимости: множество модулей импортируют
// `type Settings` именно отсюда (appearanceProfile, ShareSection, ...).
export type { Settings };

export interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  saveSetting: (key: string, value: unknown) => Promise<boolean>;
  saveMultiple: (items: Settings) => Promise<boolean>;
  resetSettings: () => Promise<boolean>;
  exportSettings: () => Promise<void>;
  importSettings: (file: File) => Promise<boolean>;
}

/**
 * Раньше создавал React-контекст; теперь лишь инициализирует стор один раз при
 * монтировании (загрузка настроек + подписка на chrome.storage.onChanged).
 * Остаётся в дереве `App`, чтобы инициализация по-прежнему происходила на
 * открытии попапа и `App.tsx` не пришлось менять.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    useVKifyStore.getState().initStorageSync();
  }, []);
  return <>{children}</>;
}

/**
 * Возвращает тот же контракт, что и прежний контекст. Каждое поле берётся
 * отдельным селектором — экшены стабильны (создаются один раз), поэтому
 * ре-рендер потребителя происходит только при изменении `settings`/`loading`,
 * как и было с мемоизированным value контекста.
 */
export function useSettings(): SettingsContextValue {
  const settings = useVKifyStore((s) => s.settings);
  const loading = useVKifyStore((s) => s.loading);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const resetSettings = useVKifyStore((s) => s.resetSettings);
  const exportSettings = useVKifyStore((s) => s.exportSettings);
  const importSettings = useVKifyStore((s) => s.importSettings);

  return { settings, loading, saveSetting, saveMultiple, resetSettings, exportSettings, importSettings };
}
