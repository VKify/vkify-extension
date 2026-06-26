/**
 * Типы канонического store настроек (см. settings.ts).
 *
 * `Settings` намеренно равен `ExtensionSettings` (у него есть index-signature
 * `[key: string]: unknown`), поэтому динамический доступ по строковому ключу —
 * `settings[id]` в фичах и тоглах попапа — продолжает работать без приведений.
 */
import type { StoreApi } from 'zustand';
import type { ExtensionSettings } from '@/types/index.js';

/** Полный срез пользовательских настроек. */
export type Settings = ExtensionSettings;

/** Частичный патч для setSettings / возврат updateSettings. */
export type PartialSettings = Partial<Settings>;

/** Данные + действия канонического store. */
export interface SettingsState {
  /** Текущие настройки (UI-ключи; не-settings ключи отфильтрованы — см. isNonUiStateKey). */
  settings: Settings;
  /** true до завершения первой гидрации из chrome.storage.local. */
  loading: boolean;

  /** Merge-patch + немедленный write-through в chrome.storage.local. */
  setSettings: (patch: PartialSettings) => void;
  /** Та же запись, но через `prev => patch` (атомарно к текущему состоянию). */
  updateSettings: (updater: (prev: Settings) => PartialSettings) => void;
  /** Сброс к RESET_SETTINGS с сохранением PRESERVED_KEYS (токен/спай/профили). */
  resetSettings: () => Promise<void>;
}

export type SettingsStoreApi = StoreApi<SettingsState>;
