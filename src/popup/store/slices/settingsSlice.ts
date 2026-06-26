import type { StateCreator } from 'zustand';
import { sanitizeSettings } from '@/shared/constants/settings-schema.js';
import { downloadText } from '@/shared/utils/download.js';
import { reloadVKTabs } from '@/popup/utils/tabs.js';
import { settingsStore } from '@/shared/store/index.js';
import type { ExtensionSettings } from '@/types/index.js';
import { PRESERVED_KEYS, EXPORT_EXCLUDED_KEYS, isNonUiStateKey } from '../keys.js';
import type { VKifyState } from '../index.js';

// Состояние настроек — тот же типизированный `ExtensionSettings`, что и
// DEFAULT_SETTINGS/RESET_SETTINGS. У него есть `[key: string]: unknown` для
// локальных ключей, поэтому динамический доступ по строке продолжает работать.
export type Settings = ExtensionSettings;

export interface SettingsSlice {
  settings: Settings;
  loading: boolean;

  /** Перечитать всё из канонического store (зеркало settingsStore → popup-store). */
  loadSettings: () => Promise<void>;
  saveSetting: (key: string, value: unknown) => Promise<boolean>;
  saveMultiple: (items: Settings) => Promise<boolean>;
  resetSettings: () => Promise<boolean>;
  exportSettings: () => Promise<void>;
  importSettings: (file: File) => Promise<boolean>;

  /**
   * Однократно: завести одно-направленное зеркало settingsStore → popup-store.
   * Идемпотентна. Миграции + подписку на chrome.storage.onChanged держит сам
   * settingsStore (он стартует при импорте), здесь их БОЛЬШЕ НЕТ — popup-слайс
   * только отражает каноничное состояние, чтобы 40+ компонентов на
   * `useVKifyStore(s => s.settings)` не пришлось трогать.
   */
  initStorageSync: () => void;
}

// Гард: зеркало навешивается один раз на сессию попапа (StrictMode/двойной mount).
let mirrorInitialized = false;

export const createSettingsSlice: StateCreator<
  VKifyState,
  [['zustand/devtools', never]],
  [],
  SettingsSlice
> = (set, get) => ({
  // Стартовое значение — текущее состояние settingsStore (может быть ещё
  // `loading:true` до завершения гидрации; зеркало догонит его через subscribe).
  settings: settingsStore.getState().settings,
  loading: settingsStore.getState().loading,

  loadSettings: async (): Promise<void> => {
    // Источник правды — settingsStore; просто отражаем его актуальное состояние.
    const { settings, loading } = settingsStore.getState();
    set({ settings, loading }, false, 'settings/load');
  },

  saveSetting: async (key: string, value: unknown): Promise<boolean> => {
    // Оптимистично + write-through делает settingsStore (trackedSet middleware).
    // Контентный скрипт реагирует на chrome.storage.onChanged сам.
    settingsStore.getState().setSettings({ [key]: value });
    return true;
  },

  saveMultiple: async (items: Settings): Promise<boolean> => {
    settingsStore.getState().setSettings(items);
    return true;
  },

  resetSettings: async (): Promise<boolean> => {
    try {
      // Сохранение auth/spy/профилей + применение RESET_SETTINGS — внутри store.
      await settingsStore.getState().resetSettings();
      return true;
    } catch (error) {
      console.error('Error resetting settings:', error);
      return false;
    }
  },

  exportSettings: async (): Promise<void> => {
    // Strip runtime/auth keys and device-local stats counters — machine-specific,
    // must not be shared between accounts/devices.
    const { settings } = get();
    const exportableSettings = Object.fromEntries(
      Object.entries(settings).filter(
        ([key]) => !isNonUiStateKey(key) && !EXPORT_EXCLUDED_KEYS.has(key),
      ),
    );

    const exportData = {
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      settings: exportableSettings,
    };

    const json = JSON.stringify(exportData, null, 2);
    downloadText(json, `vkify-settings-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  },

  importSettings: async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { settings?: Settings } | Settings;
      const rawSettings = (data as { settings?: Settings }).settings || (data as Settings);

      if (typeof rawSettings !== 'object' || rawSettings === null || Array.isArray(rawSettings)) {
        throw new Error('Invalid settings format');
      }

      const newSettings = sanitizeSettings(rawSettings, 'import');

      // Preserve auth + spy data AND device-local stats counters.
      const keysToPreserve = [...PRESERVED_KEYS, ...EXPORT_EXCLUDED_KEYS];
      const preserved = await chrome.storage.local.get(keysToPreserve);

      // Импорт — полная замена: пишем напрямую (clear+set), т.к. это единственный
      // flow с удалением «лишних» ключей (setSettings лишь мёржит). settingsStore
      // подхватит изменения через onChanged; но чтобы UI обновился детерминированно
      // (без гонки с асинхронным onChanged), синхронно толкаем UI-срез в store.
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ ...newSettings, ...preserved });

      const uiOnly: Settings = {};
      for (const [k, v] of Object.entries({ ...newSettings, ...preserved })) {
        if (!isNonUiStateKey(k)) uiOnly[k] = v;
      }
      settingsStore.setState({ settings: uiOnly }); // → зеркало обновит popup-store

      reloadVKTabs();
      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  },

  initStorageSync: (): void => {
    if (mirrorInitialized) return;
    mirrorInitialized = true;

    // settingsStore при импорте уже: (1) прогнал миграции, (2) подписался на
    // chrome.storage.onChanged. Здесь — только зеркало его состояния в popup-store.
    const mirror = (): void => {
      const { settings, loading } = settingsStore.getState();
      set({ settings, loading }, false, 'settings/mirror');
    };
    mirror();                       // первичная синхронизация (на случай уже-готового store)
    settingsStore.subscribe(mirror); // на каждое изменение settingsStore (гидрация, reconcile, set)
  },
});

/** Только для тестов: сброс гарда зеркала между кейсами. */
export function __resetStorageSyncForTests(): void {
  mirrorInitialized = false;
}
