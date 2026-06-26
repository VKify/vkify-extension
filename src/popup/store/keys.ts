import { StorageKey } from '@/shared/constants/storage-keys.js';

/**
 * Ключи storage, которые НЕ являются частью settings-state попапа.
 *
 * Перенесено как есть из бывшего `SettingsContext.tsx`: store и юнит-тесты
 * импортируют отсюда единый источник правды о том, что не должно жить в React-
 * state и что переживает reset/import. Логика классификации не менялась.
 */

// Auth + bulk spy data. Needed at runtime but never part of the settings UI:
// kept out of React state so we don't deserialize / re-render large per-user
// activity time-series on every popup open and on every storage change a spy
// interval makes. Also the exact key set preserved across reset/import.
export const PRESERVED_KEYS: readonly string[] = [
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

export function isNonUiStateKey(key: string): boolean {
  return PRESERVED_SET.has(key) || RUNTIME_COUNTER_KEYS.has(key) || key.startsWith('activity_');
}

// Keys excluded only from export/import, but still readable in React state
// (stats are device-local runtime counters — meaningless on another machine).
export const EXPORT_EXCLUDED_KEYS = new Set([
  'stats_trackers_blocked',
  'stats_ads_blocked',
  'stats_block_log',
]);
