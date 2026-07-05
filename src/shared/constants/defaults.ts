import type { ExtensionSettings } from '../../types/index.js';

export const DEFAULT_SETTINGS: Partial<ExtensionSettings> = {
  block_left_ads: true,
  block_feed_ads_api: true,
  block_feed_ads_dom: true,
  block_trackers: true,
  perf_widget: false,
  extension_theme: 'auto',
  first_run: true,
  spy_online: false,
  spy_online_interval: 60,
  spy_browser_notify: true,
  spy_save_log: true,
  spy_tracked_users: [],
  online_tracked_users: [],
  // Типы событий слежки за сообщениями. Сидируем явно, иначе тоггл в попапе
  // (`settings[id] === true`) выглядит ВЫКЛ, а трекер считал бы отсутствие
  // значения за ВКЛ (`!== false`) — и следил бы за тем, что показано выключенным.
  // По умолчанию ВКЛ всё, кроме событий беседы (вход/выход шумны в больших чатах).
  spy_typing: true,
  spy_voice: true,
  spy_uploads: true,
  spy_read: true,
  spy_delete: true,
  spy_friends: true,
  spy_invisibility: true,
  spy_messages: true,
  spy_edit: true,
  spy_calls: true,
  spy_chat_events: false,
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
  // Быстрое копирование текста сообщения + экспорт диалога целиком в файл.
  // По умолчанию включаем — фичи неинвазивные, добавляют только новую кнопку.
  message_quick_copy: true,
  dialog_export_enabled: true,
  message_pin_notes: true,
  message_templates: [
    { id: 'tpl_hello',   name: 'Привет',   text: 'Привет, %first_name%!', addedAt: Date.now() },
    { id: 'tpl_hi_back', name: 'Спокойной ночи', text: 'Спокойной ночи, %first_name% 🌙', addedAt: Date.now() },
    { id: 'tpl_when',    name: 'Время сейчас', text: 'Сейчас %time%', addedAt: Date.now() },
  ],
  page_offset_value: 50,
  // Скрытые пункты левого меню — по умолчанию ничего не скрыто.
  hidden_menu_items: [],
  // Ширина контента: тоггл и значение разделены — как у смещения страницы.
  content_width_enabled: false,
  content_width: 1100,
  video_download: false,
  story_download: false,
  clip_download: false,
  photo_download: false,
  audio_autoplay: false,
  audio_download_format: 'mp3',
  audio_multi_upload: false,
  audio_upload_delay_between: 2000,
  audio_upload_delay_save: 500,
  audio_equalizer: false,
  audio_equalizer_preamp: 0,
  audio_equalizer_bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  audio_equalizer_preset: 'flat',
  audio_equalizer_custom_presets: [],
  // Тумблеры новых фич «Центра»/«Скрытия» — выкл по умолчанию (включаются при
  // settings[id] === true). Сидируем явно, чтобы попап-тоггл и storage не расходились.
  communities_my_groups_redirect: false,
  communities_swap_columns: false,
  profile_swap_columns: false,
  hide_feed_right_column: false,
  hide_profile_right_column: false,
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
  perf_widget: false,
  extension_theme: 'auto',
};