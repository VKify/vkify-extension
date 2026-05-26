import type { ExtensionSettings } from '../../types/index.js';

export const DEFAULT_SETTINGS: Partial<ExtensionSettings> = {
  block_left_ads: true,
  block_feed_ads_api: true,
  block_feed_ads_dom: true,
  block_trackers: true,
  extension_theme: 'auto',
  first_run: true,
  spy_online: false,
  spy_online_interval: 60,
  spy_browser_notify: true,
  spy_save_log: true,
  spy_tracked_users: [],
  online_tracked_users: [],
  // Profile spy — отслеживание аватарки/статуса/новых друзей.
  // По умолчанию ВЫКЛ, чтобы пользователь сам выбрал, кого мониторить.
  profile_spy: false,
  profile_spy_interval: 300, // 5 минут — не упереться в rate-limit
  profile_spy_avatar: true,
  profile_spy_status: true,
  profile_spy_friends: true,
  profile_spy_browser_notify: true,
  profile_spy_save_log: true,
  profile_tracked_users: [],
  // Message templates — выключены до явного включения пользователем, чтобы
  // hotkey/слэш-триггеры не «мешали» сразу после установки.
  message_templates_enabled: false,
  message_templates_trigger_slash: true,
  message_templates_trigger_hotkey: true,
  // Ctrl+Space — нейтральный дефолт (не конфликтует с базовыми хоткеями VK).
  message_templates_hotkey: { ctrlKey: true, shiftKey: false, altKey: false, code: 'Space', label: 'Ctrl+Space' },
  message_templates_trigger_autocomplete: false,
  message_templates_auto_send: false,
  message_templates: [
    { id: 'tpl_hello',   name: 'Привет',   text: 'Привет, %first_name%!', addedAt: Date.now() },
    { id: 'tpl_hi_back', name: 'Спокойной ночи', text: 'Спокойной ночи, %first_name% 🌙', addedAt: Date.now() },
    { id: 'tpl_when',    name: 'Время сейчас', text: 'Сейчас %time%', addedAt: Date.now() },
  ],
  page_offset_value: 50,
  video_download: false,
  story_download: false,
  message_crypto: false,
  message_crypto_format: 'VKify' as const,
  message_crypto_key: '',
  message_crypto_coffee_marker: 'PP' as const,
};

export const RESET_SETTINGS: Partial<ExtensionSettings> = {
  block_left_ads: true,
  block_feed_ads_api: true,
  block_feed_ads_dom: true,
  block_trackers: true,
  extension_theme: 'auto',
};