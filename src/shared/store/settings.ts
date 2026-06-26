/**
 * Каноничный store настроек расширения — Single Source of Truth.
 *
 * По одному инстансу на JS-realm (popup / content / background). Межконтекстная
 * синхронизация идёт через chrome.storage.onChanged внутри storageSync-middleware,
 * НЕ через общую память: объект store между контекстами не делится.
 *
 *   React  (popup):   const { settings, setSettings } = useSettingsStore();
 *   non-React:        settingsStore.getState().setSettings({ ... });
 *                     settingsStore.subscribe(s => s.settings.x, listener);
 *
 * devtools подключается ТОЛЬКО в realm с window (popup) и только в dev: в SW
 * (background) window нет, а devtools-middleware к нему обращается.
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';

import { RESET_SETTINGS } from '@/shared/constants/defaults.js';
import { migrator } from '@/shared/storage/Migrator.js';
import { PRESERVED_KEYS, isNonUiStateKey } from '@/popup/store/keys.js';
import { coerceStoredSettings } from './validation.js';
import { storageSync, pickSyncKeys, SYNC_MIRROR_KEYS } from './storageMiddleware.js';
import type { Settings, PartialSettings, SettingsState } from './types.js';

/** window есть только в popup-realm; в service worker'е — нет. */
const HAS_WINDOW = typeof window !== 'undefined';

function isDev(): boolean {
  try {
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

const DEVTOOLS_ENABLED = HAS_WINDOW && isDev();

/** Best-effort запись в sync-mirror (см. SYNC_MIRROR_KEYS). Падения — не критичны. */
function mirrorToSync(patch: PartialSettings): void {
  if (SYNC_MIRROR_KEYS.length === 0) return;
  const sync = pickSyncKeys(patch);
  if (Object.keys(sync).length === 0) return;
  try {
    void chrome.storage.sync?.set(sync).catch(() => {});
  } catch {
    /* sync недоступен — игнорируем */
  }
}

export const settingsStore = createStore<SettingsState>()(
  devtools(
    subscribeWithSelector(
      storageSync({
        runMigrations: () => migrator.migrate(),
        readAll: () => chrome.storage.local.get(null),
        writeMultiple: (items) => chrome.storage.local.set(items),
        subscribeChanges: (cb) => {
          chrome.storage.onChanged.addListener(cb);
          return () => chrome.storage.onChanged.removeListener(cb);
        },
        validate: coerceStoredSettings,
        verbose: DEVTOOLS_ENABLED,
      })((set, get) => ({
        settings: {},
        loading: true,

        /** Merge-patch + write-through (write-through делает trackedSet middleware). */
        setSettings: (patch: PartialSettings): void => {
          set((s) => ({ settings: { ...s.settings, ...patch } }), false, 'settings/set');
          mirrorToSync(patch);
        },

        /** Functional-updater форма (как React setState(prev => …)). */
        updateSettings: (updater): void => {
          get().setSettings(updater(get().settings));
        },

        /** Сброс к RESET_SETTINGS, сохраняя auth/spy/профили (PRESERVED_KEYS). */
        resetSettings: async (): Promise<void> => {
          const preserved = await chrome.storage.local.get([...PRESERVED_KEYS]);
          await chrome.storage.local.clear();
          await chrome.storage.local.set({ ...preserved, ...RESET_SETTINGS });

          // В state кладём только UI-срез нового содержимого — без stale-ключей.
          const uiOnly: Settings = {};
          for (const [k, v] of Object.entries({ ...preserved, ...RESET_SETTINGS })) {
            if (!isNonUiStateKey(k)) uiOnly[k] = v;
          }
          set({ settings: uiOnly }, false, 'settings/reset');
        },
      })),
    ),
    { name: 'VKify Settings', enabled: DEVTOOLS_ENABLED },
  ),
);

/**
 * React-binding. Обе формы желаемого API:
 *   const { settings, setSettings } = useSettingsStore();        // весь state
 *   const theme = useSettingsStore(s => s.settings.extension_theme); // селектор
 *
 * Статика повторяет vanilla-API для не-React контекстов:
 *   useSettingsStore.getState() / .setState() / .subscribe()
 */
export function useSettingsStore(): SettingsState;
export function useSettingsStore<U>(selector: (s: SettingsState) => U): U;
export function useSettingsStore<U>(selector?: (s: SettingsState) => U): U | SettingsState {
  return selector ? useStore(settingsStore, selector) : useStore(settingsStore);
}
useSettingsStore.getState = settingsStore.getState;
useSettingsStore.setState = settingsStore.setState;
useSettingsStore.subscribe = settingsStore.subscribe;

export { SYNC_MIRROR_KEYS };
