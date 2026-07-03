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
    description: 'Чистая лента без историй, рекомендаций и лишних блоков; компактные отступы.',
    replacesAppearance: true,
    settings: {
      hide_stories: true,
      hide_recommendations: true,
      hide_friends_suggestions: true,
      hide_mini_chat: true,
      hide_menu_counters: true,
      hide_recommended_channels: true,
      hide_recent_groups: true,
      hide_emoji_status: true,
      hide_scroll_top: true,
      compact_spacing: true,
      minimalistic_sidebar: true,
    },
  },
  {
    id: 'preset_privacy',
    name: 'Приватность',
    description: 'Не показывать набор текста и прочтения, блокировать трекеры, обходить редирект away.php.',
    settings: {
      prevent_typing: true,
      prevent_read: true,
      block_trackers: true,
      bypass_away_links: true,
    },
  },
  {
    id: 'preset_performance',
    name: 'Производительность',
    description: 'Выключить тяжёлые визуальные эффекты и фоновые подсистемы — максимум отзывчивости.',
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
      audio_equalizer: false,
    },
  },
];
