import type { ExtensionSettings } from '../../types/index.js';

/**
 * Централизованные константы для всех ключей chrome.storage.local.
 *
 * Раньше строки ('online_spy_log', 'vk_access_token' и т.д.) были разбросаны
 * по 5+ файлам. Теперь единственный источник истины — этот файл.
 * Опечатка в ключе теперь поймается TypeScript, а не в рантайме.
 */
export const StorageKey = {
  VK_ACCESS_TOKEN:    'vk_access_token',
  VK_USER_ID:         'vk_user_id',
  VK_TOKEN_EXPIRES_AT: 'vk_token_expires_at',

  // Эффективная схема VK ('dark' | 'light'), которую content-script снимает со
  // страницы vk.com. Попап в режиме темы «Как в ВК» подхватывает её для единого
  // вида окна и встроенной страницы настроек.
  VK_SCHEME:          'vk_scheme',

  ONLINE_SPY_STATS:   'online_spy_stats',
  USER_ONLINE_STATUS: 'user_online_status',
  ONLINE_SPY_LOG:     'online_spy_log',
  ACTIVITY_SPY_LOG:   'activity_spy_log',

  // Tracked-users lists are split per feature so the two spy modes are fully
  // independent. ONLINE_TRACKED_USERS feeds the background online-monitor;
  // the activity (messages) spy keeps using 'spy_tracked_users'.
  ONLINE_TRACKED_USERS: 'online_tracked_users',

  // Message templates — array of MessageTemplate edited in popup "Шаблоны" tab.
  MESSAGE_TEMPLATES: 'message_templates',

  // Pinned notes — array of PinnedNote, saved via the message info-row pin button.
  VKIFY_NOTES: 'vkify_notes',

  // Favorite settings — array of function ids from popup/constants/functions.ts.
  // Управляются через SearchPalette (Ctrl+K → клик по звезде).
  VKIFY_FAVORITES: 'vkify_favorites',

  // Profile spy — periodically polls users.get for avatar/status/friends-counter
  // changes. Independent storage from online monitor & activity spy.
  PROFILE_SPY_STATS:      'profile_spy_stats',
  PROFILE_SPY_LOG:        'profile_spy_log',
  USER_PROFILE_SNAPSHOT:  'user_profile_snapshot',
  PROFILE_TRACKED_USERS:  'profile_tracked_users',

  FIRST_RUN:              'first_run',
  PENDING_UPDATE_VERSION: 'pending_update_version',
  ONBOARDING_DONE:        'onboarding_done',
} as const;

export type StorageKeyValue = typeof StorageKey[keyof typeof StorageKey];

/** Возвращает ключ для хранения истории активности конкретного пользователя. */
export const activityKey = (userId: string): string => `activity_${userId}`;

/**
 * Минимальный набор ключей, необходимых для запуска/остановки online-spy.
 * Используется вместо get(null) в hot path (handleSettingsChange, handleStartSpy).
 *
 * Тип `SpySettingKey` привязан к явно объявленным свойствам ExtensionSettings
 * (index signature `[key: string]: unknown` исключена через DefinedKeys<T>).
 * Если ключ переименован в ExtensionSettings — компилятор ошибётся здесь.
 */

/** Extracts only explicitly-declared keys from an interface, ignoring index signatures. */
type DefinedKeys<T> = {
  [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K];
};

type SpySettingKey = Extract<
  keyof DefinedKeys<ExtensionSettings>,
  'spy_online' | 'spy_online_interval' | 'online_tracked_users' | 'spy_browser_notify' | 'spy_save_log'
>;

// Feeds the background online-monitor (spy-tracker). Uses online_tracked_users,
// NOT spy_tracked_users (that one belongs to the activity spy).
export const SPY_SETTINGS_KEYS: readonly SpySettingKey[] = [
  'spy_online',
  'spy_online_interval',
  'online_tracked_users',
  'spy_browser_notify',
  'spy_save_log',
] as const;

// Feeds the background profile-tracker (avatar/status/friends-counter polling).
type ProfileSpySettingKey = Extract<
  keyof DefinedKeys<ExtensionSettings>,
  | 'profile_spy'
  | 'profile_spy_interval'
  | 'profile_tracked_users'
  | 'profile_spy_avatar'
  | 'profile_spy_status'
  | 'profile_spy_friends'
  | 'profile_spy_browser_notify'
  | 'profile_spy_save_log'
>;

export const PROFILE_SPY_SETTINGS_KEYS: readonly ProfileSpySettingKey[] = [
  'profile_spy',
  'profile_spy_interval',
  'profile_tracked_users',
  'profile_spy_avatar',
  'profile_spy_status',
  'profile_spy_friends',
  'profile_spy_browser_notify',
  'profile_spy_save_log',
] as const;