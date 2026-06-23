import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { RESET_SETTINGS } from '../../shared/constants/defaults.js';
import { StorageKey } from '../../shared/constants/storage-keys.js';
import { sanitizeSettings } from '../../shared/constants/settings-schema.js';
import { downloadText } from '../../shared/utils/download.js';
import { reloadVKTabs } from '../utils/tabs.js';
import type { ExtensionSettings } from '../../types/index.js';

// Состояние настроек в popup'е — это тот же типизированный `ExtensionSettings`,
// что и DEFAULT_SETTINGS/RESET_SETTINGS (единый источник правды в types/index.ts).
// Раньше тут был анонимный `Record<string, unknown>`, из-за чего все 37
// потребителей `useSettings()` читали каждую настройку как `unknown` без проверки
// типов. У ExtensionSettings есть `[key: string]: unknown` для локальных ключей,
// поэтому динамический доступ по строке продолжает работать.
export type Settings = ExtensionSettings;

// Auth + bulk spy data. Needed at runtime but never part of the settings UI:
// kept out of React state so we don't deserialize / re-render large per-user
// activity time-series on every popup open and on every storage change a spy
// interval makes. Also the exact key set preserved across reset/import.
const PRESERVED_KEYS: readonly string[] = [
  StorageKey.VK_ACCESS_TOKEN,
  StorageKey.VK_USER_ID,
  StorageKey.VK_TOKEN_EXPIRES_AT,
  StorageKey.VK_SCHEME,
  StorageKey.ONLINE_SPY_STATS,
  StorageKey.USER_ONLINE_STATUS,
  StorageKey.ONLINE_STATUS_HIDDEN,
  StorageKey.ONLINE_SPY_LOG,
  StorageKey.ACTIVITY_SPY_LOG,
  StorageKey.PROFILE_SPY_STATS,
  StorageKey.USER_PROFILE_SNAPSHOT,
  StorageKey.PROFILE_SPY_LOG,
  StorageKey.FIRST_RUN,
  StorageKey.ONBOARDING_DONE,
  // Локальные профили оформления — пользовательские пресеты, не должны
  // теряться при «Сбросить настройки» и не относятся к settings-state.
  StorageKey.APPEARANCE_PROFILES,
];
const PRESERVED_SET = new Set<string>(PRESERVED_KEYS);

// Runtime counters that content scripts rewrite on a timer (ads-blocking
// flushes every ~1.5s while the feed is open, auto-add — on every tick).
// They are consumed locally by their tabs via useStorageReload, so keeping
// them out of React state avoids re-rendering the whole popup on every flush.
const RUNTIME_COUNTER_KEYS = new Set([
  'stats_trackers_blocked',
  'stats_ads_blocked',
  'stats_block_log',
  'auto_add_stats',
  // PerfWidget пишет позицию в storage на каждый drop, а флаг открытия дашборда —
  // транзиентный; держим их вне React-state, чтобы не ре-рендерить весь попап.
  'perfWidgetPosition',
  'open_perf_dashboard',
]);

function isNonUiStateKey(key: string): boolean {
  return PRESERVED_SET.has(key) || RUNTIME_COUNTER_KEYS.has(key) || key.startsWith('activity_');
}

// Keys excluded only from export/import, but still readable in React state
// (stats are device-local runtime counters — meaningless on another machine).
const EXPORT_EXCLUDED_KEYS = new Set([
  'stats_trackers_blocked',
  'stats_ads_blocked',
  'stats_block_log',
]);

interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  saveSetting: (key: string, value: unknown) => Promise<boolean>;
  saveMultiple: (items: Settings) => Promise<boolean>;
  resetSettings: () => Promise<boolean>;
  exportSettings: () => Promise<void>;
  importSettings: (file: File) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadSettings();

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName === 'local') {
        setSettings(prev => {
          // Возвращаем prev как есть, если все изменения отфильтрованы:
          // новый объект = ре-рендер всего дерева, а storage дёргают
          // спай-трекеры и счётчики блокировок каждые пару секунд.
          let updated: Settings | null = null;
          for (const [key, { newValue }] of Object.entries(changes)) {
            if (isNonUiStateKey(key)) continue;
            if (prev[key] === newValue) continue;
            (updated ??= { ...prev })[key] = newValue;
          }
          return updated ?? prev;
        });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const loadSettings = async (): Promise<void> => {
    try {
      const result = await chrome.storage.local.get(null);
      const uiOnly: Settings = {};
      for (const [key, value] of Object.entries(result)) {
        if (!isNonUiStateKey(key)) uiOnly[key] = value;
      }
      setSettings(uiOnly);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSetting = useCallback(async (key: string, value: unknown): Promise<boolean> => {
    try {
      setSettings(prev => ({ ...prev, [key]: value }));
      await chrome.storage.local.set({ [key]: value });
      // Контентный скрипт слушает chrome.storage.onChanged и реагирует сам —
      // явное ENABLE_FEATURE/DISABLE_FEATURE вызывало двойной триггер
      // (disable→enable дважды, что приводило к кратковременному мерцанию).
      return true;
    } catch (error) {
      console.error('Error saving setting:', error);
      await loadSettings();
      return false;
    }
  }, []);

  const saveMultiple = useCallback(async (items: Settings): Promise<boolean> => {
    try {
      setSettings(prev => ({ ...prev, ...items }));
      await chrome.storage.local.set(items);
      // storage.onChanged в контентном скрипте обрабатывает все ключи автоматически.
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      await loadSettings();
      return false;
    }
  }, []);

  const resetSettings = useCallback(async (): Promise<boolean> => {
    try {
      // Сохраняем токен и данные слежки — они не относятся к настройкам UI.
      // chrome.storage.local.clear() уничтожил бы авторизацию пользователя.
      const preserved = await chrome.storage.local.get([...PRESERVED_KEYS]);

      await chrome.storage.local.clear();
      await chrome.storage.local.set({ ...preserved, ...RESET_SETTINGS });
      setSettings(prev => ({ ...prev, ...RESET_SETTINGS }));
      return true;
    } catch (error) {
      console.error('Error resetting settings:', error);
      return false;
    }
  }, []);

  const exportSettings = useCallback(async (): Promise<void> => {
    // Strip runtime/auth keys and device-local stats counters — machine-specific,
    // must not be shared between accounts/devices.
    // (settings state already excludes PRESERVED_KEYS; belt & braces.)
    const exportableSettings = Object.fromEntries(
      Object.entries(settings).filter(
        ([key]) => !isNonUiStateKey(key) && !EXPORT_EXCLUDED_KEYS.has(key),
      )
    );

    const exportData = {
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      settings: exportableSettings,
    };

    const json = JSON.stringify(exportData, null, 2);
    downloadText(json, `vkify-settings-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  }, [settings]);

  const importSettings = useCallback(async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as { settings?: Settings } | Settings;
      const rawSettings = (data as { settings?: Settings }).settings || data as Settings;

      if (typeof rawSettings !== 'object' || rawSettings === null || Array.isArray(rawSettings)) {
        throw new Error('Invalid settings format');
      }

      const newSettings = sanitizeSettings(rawSettings, 'import');

      // Preserve auth + spy data AND device-local stats counters.
      // Stats are never part of an exported file (see EXPORT_EXCLUDED_KEYS),
      // so they must be explicitly restored after clear() to avoid losing them.
      const keysToPreserve = [...PRESERVED_KEYS, ...EXPORT_EXCLUDED_KEYS];
      const preserved = await chrome.storage.local.get(keysToPreserve);

      await chrome.storage.local.clear();
      await chrome.storage.local.set({ ...newSettings, ...preserved });
      setSettings({ ...newSettings, ...preserved });

      reloadVKTabs();

      return true;
    } catch (error) {
      console.error('Import error:', error);
      return false;
    }
  }, []);

  // Мемоизируем value: без этого объект пересоздавался на каждый рендер
  // провайдера и тянул за собой ре-рендер ВСЕХ потребителей контекста (37
  // файлов) даже когда менялась одна настройка в другой вкладке. Колбэки
  // стабильны (useCallback), так что значение меняется только при смене
  // settings/loading.
  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    loading,
    saveSetting,
    saveMultiple,
    resetSettings,
    exportSettings,
    importSettings,
  }), [settings, loading, saveSetting, saveMultiple, resetSettings, exportSettings, importSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}