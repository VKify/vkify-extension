/**
 * Встроенные пресеты настроек — курируемые наборы фич «одной кнопкой».
 *
 * Data-only модуль (никакой логики применения): применяет попап
 * (PresetsSection), переиспользуя механику профилей оформления
 * (buildApplyPatch из popup/utils/appearanceProfile.ts) либо точечный merge —
 * в зависимости от `replacesAppearance`.
 *
 * `settings` типизированы через Partial<ExtensionSettings> — несуществующий
 * ключ или неверный тип значения не пройдут typecheck (никаких runtime-проверок
 * не нужно).
 *
 * Пресет ≠ профиль: профили — пользовательские снимки оформления (создаются в
 * попапе, живут в storage), пресеты — встроенные, версионируются с кодом.
 */

import type { ExtensionSettings } from '../../types/index.js';

export interface SettingsPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Применяемые значения. Ключи проверяются типом ExtensionSettings. */
  readonly settings: Readonly<Partial<ExtensionSettings>>;
  /**
   * true — пресет описывает оформление целиком: применяется как профиль
   * (сначала сброс всех APPEARANCE_KEYS к дефолтам, затем патч).
   * false/не задан — точечный merge: меняются только перечисленные ключи.
   */
  readonly replacesAppearance?: boolean;
}

export const BUILTIN_PRESETS: readonly SettingsPreset[] = [
  {
    id: 'preset_minimal',
    name: 'Минимализм',
    description: 'Чистая лента и профиль без историй, рекомендаций, промо и боковых блоков; компактные отступы.',
    replacesAppearance: true,
    settings: {
      hide_stories: true,
      hide_friends_suggestions: true,
      hide_mini_chat: true,
      hide_menu_counters: true,
      hide_recommended_channels: true,
      hide_recent_groups: true,
      hide_emoji_status: true,
      hide_scroll_top: true,
      hide_feed_right_column: true,
      hide_profile_right_column: true,
      hide_profile_friends_recommendations: true,
      hide_stories_discover: true,
      hide_promo_link: true,
      hide_business_notifications: true,
      collapse_search: true,
      compact_spacing: true,
      minimalistic_sidebar: true,
    },
  },
  {
    id: 'preset_privacy',
    name: 'Приватность',
    description: 'Скрыть набор текста, прочтения и просмотры историй; размывать неактивную вкладку, блокировать трекеры и обходить away.php.',
    settings: {
      prevent_typing: true,
      prevent_read: true,
      prevent_story_views: true,
      prevent_notification_read: true,
      blur_on_unfocus: true,
      block_trackers: true,
      bypass_away_links: true,
    },
  },
  {
    id: 'preset_performance',
    name: 'Производительность',
    description: 'Выключить визуальные эффекты, музыкальные виджеты, часы, слежку и Telegram-уведомления — максимум отзывчивости.',
    settings: {
      glass_blur: 0,
      block_depth: false,
      custom_background: '',
      filter_grayscale: false,
      filter_sepia: false,
      filter_invert: false,
      filter_dim_images: false,
      filter_high_contrast: false,
      filter_low_brightness: false,
      spy_online: false,
      profile_spy: false,
      perf_widget: false,
      ad_stats_widget: false,
      audio_equalizer: false,
      music_visualizer: false,
      music_lyrics: false,
      music_mini_player: false,
      clock_enabled: false,
      telegram_notifications_enabled: false,
    },
  },
];
