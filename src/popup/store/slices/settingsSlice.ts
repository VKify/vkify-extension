import type { StateCreator } from 'zustand';
import { RESET_SETTINGS } from '@/shared/constants/defaults.js';
import { sanitizeSettings } from '@/shared/constants/settings-schema.js';
import { downloadText } from '@/shared/utils/download.js';
import { reloadVKTabs } from '@/popup/utils/tabs.js';
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

  /** Перечитать всё из chrome.storage.local (фильтруя non-UI ключи). */
  loadSettings: () => Promise<void>;
  saveSetting: (key: string, value: unknown) => Promise<boolean>;
  saveMultiple: (items: Settings) => Promise<boolean>;
  resetSettings: () => Promise<boolean>;
  exportSettings: () => Promise<void>;
  importSettings: (file: File) => Promise<boolean>;

  /**
   * Однократно: загрузить настройки и подписаться на chrome.storage.onChanged.
   * Идемпотентна (вешает листенер ровно один раз на сессию попапа).
   */
  initStorageSync: () => void;
}

// Гард: store — модульный синглтон, listener должен навешиваться один раз,
// даже если SettingsProvider пере-смонтируется (StrictMode/двойной mount).
let storageSyncInitialized = false;

export const createSettingsSlice: StateCreator<
  VKifyState,
  [['zustand/devtools', never]],
  [],
  SettingsSlice
> = (set, get) => ({
  settings: {},
  loading: true,

  loadSettings: async (): Promise<void> => {
    try {
      const result = await chrome.storage.local.get(null);
      const uiOnly: Settings = {};
      for (const [key, value] of Object.entries(result)) {
        if (!isNonUiStateKey(key)) uiOnly[key] = value;
      }
      set({ settings: uiOnly }, false, 'settings/load');
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      set({ loading: false }, false, 'settings/loadDone');
    }
  },

  saveSetting: async (key: string, value: unknown): Promise<boolean> => {
    try {
      set((s) => ({ settings: { ...s.settings, [key]: value } }), false, 'settings/saveSetting');
      await chrome.storage.local.set({ [key]: value });
      // Контентный скрипт слушает chrome.storage.onChanged и реагирует сам —
      // явное ENABLE_FEATURE/DISABLE_FEATURE вызывало двойной триггер.
      return true;
    } catch (error) {
      console.error('Error saving setting:', error);
      await get().loadSettings();
      return false;
    }
  },

  saveMultiple: async (items: Settings): Promise<boolean> => {
    try {
      set((s) => ({ settings: { ...s.settings, ...items } }), false, 'settings/saveMultiple');
      await chrome.storage.local.set(items);
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      await get().loadSettings();
      return false;
    }
  },

  resetSettings: async (): Promise<boolean> => {
    try {
      // Сохраняем токен и данные слежки — они не относятся к настройкам UI.
      // chrome.storage.local.clear() уничтожил бы авторизацию пользователя.
      const preserved = await chrome.storage.local.get([...PRESERVED_KEYS]);

      await chrome.storage.local.clear();
      await chrome.storage.local.set({ ...preserved, ...RESET_SETTINGS });
      set((s) => ({ settings: { ...s.settings, ...RESET_SETTINGS } }), false, 'settings/reset');
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

      await chrome.storage.local.clear();
      await chrome.storage.local.set({ ...newSettings, ...preserved });
      set({ settings: { ...newSettings, ...preserved } }, false, 'settings/import');

      reloadVKTabs();

      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  },

  initStorageSync: (): void => {
    if (storageSyncInitialized) return;
    storageSyncInitialized = true;

    void get().loadSettings();

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local') return;
      set(
        (s) => {
          // Не создаём новый объект settings, если все изменения отфильтрованы:
          // иначе ре-рендер всего дерева, а storage дёргают спай-трекеры и
          // счётчики блокировок каждые пару секунд. Возвращаем `{}` (нет diff'а).
          let updated: Settings | null = null;
          for (const [key, { newValue }] of Object.entries(changes)) {
            if (isNonUiStateKey(key)) continue;
            if (s.settings[key] === newValue) continue;
            (updated ??= { ...s.settings })[key] = newValue;
          }
          return updated ? { settings: updated } : {};
        },
        false,
        'settings/storageSync',
      );
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
  },
});

/** Только для тестов: сброс гарда инициализации между кейсами. */
export function __resetStorageSyncForTests(): void {
  storageSyncInitialized = false;
}
