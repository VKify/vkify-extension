import type { Settings } from '../store/slices/settingsSlice.js';

/**
 * Единый источник истины для набора параметров «оформления» — вкладки «Вид»
 * и блок скрытых элементов из «Скрытие». Используется в трёх местах:
 *   • ShareSection — кодирование темы в ссылку;
 *   • useThemeProfiles — сохранение/применение локальных профилей;
 *   • captureAppearance/buildApplyPatch ниже.
 * При добавлении новой настройки оформления — дописывать ключ сюда (и, если у
 * него есть «выключенное» значение, в DEFAULTS либо CLEAR_VALUES).
 */
export const APPEARANCE_KEYS: readonly string[] = [
  // Тема
  'custom_theme', 'custom_accent', 'block_opacity', 'glass_blur', 'theme_radius', 'block_depth',
  // Шрифт
  'custom_font_id', 'custom_font_value', 'custom_font_size', 'custom_line_height',
  'custom_letter_spacing', 'custom_font_weight', 'custom_font_style',
  'custom_text_decoration', 'custom_text_transform',
  // Layout
  'border_radius', 'avatar_radius_shape', 'content_width', 'content_width_enabled', 'compact_spacing',
  'page_offset_enabled', 'page_offset_value', 'custom_theme_id',
  // Режим отображения
  'minimalistic_sidebar', 'fixed_sidebar', 'sidebar_with_background', 'collapse_search',
  // Фон
  'custom_background', 'background_type',
  'background_blur', 'background_dim', 'background_opacity',
  'background_brightness', 'background_contrast', 'background_saturation',
  'background_scale', 'background_hue_rotate', 'background_sepia', 'background_grayscale',
  'background_position', 'background_size',
  'background_overlay_color', 'background_overlay_opacity',
  'background_vignette', 'background_video_speed', 'background_video_volume',
  // Визуальные фильтры
  'filter_grayscale', 'filter_sepia', 'filter_invert',
  'filter_dim_images', 'filter_high_contrast', 'filter_low_brightness',
  // Скрытые элементы
  'hide_stories', 'hide_post_box', 'hide_post_comments',
  'hide_recommendations', 'hide_friends_suggestions',
  'hide_emoji_status', 'hide_mini_chat', 'hide_scroll_top',
  'hide_menu_settings', 'hide_menu_counters', 'hide_audio_ads',
  'hide_recent_groups', 'hide_recommended_channels',
];

/**
 * Дефолтные значения — параметры с этими значениями считаются «выключенными» и
 * не попадают в снимок профиля. block_opacity хранится как float 0.0–1.0.
 */
export const DEFAULTS: Record<string, unknown> = {
  block_opacity:             1,
  glass_blur:                0,
  theme_radius:              0,
  block_depth:               false,
  custom_font_size:          0,
  custom_line_height:        0,
  custom_letter_spacing:     0,
  custom_font_weight:        400,
  custom_font_style:         'normal',
  custom_text_decoration:    'none',
  custom_text_transform:     'none',
  border_radius:             0,
  content_width:             0,
  content_width_enabled:     false,
  compact_spacing:           false,
  page_offset_enabled:       false,
  page_offset_value:         50,
  minimalistic_sidebar:      false,
  fixed_sidebar:             false,
  sidebar_with_background:   false,
  collapse_search:           false,
  background_blur:           0,
  background_dim:            0,
  background_opacity:        100,
  background_brightness:     100,
  background_contrast:       100,
  background_saturation:     100,
  background_scale:          100,
  background_hue_rotate:     0,
  background_sepia:          0,
  background_grayscale:      0,
  background_position:       'center',
  background_size:           'cover',
  background_overlay_opacity: 0,
  background_vignette:       0,
  background_video_speed:    100,
  background_video_volume:   0,
  filter_grayscale:          false,
  filter_sepia:              false,
  filter_invert:             false,
  filter_dim_images:         false,
  filter_high_contrast:      false,
  filter_low_brightness:     false,
  hide_stories:              false,
  hide_post_box:             false,
  hide_post_comments:        false,
  hide_recommendations:      false,
  hide_friends_suggestions:  false,
  hide_emoji_status:         false,
  hide_mini_chat:            false,
  hide_scroll_top:           false,
  hide_menu_settings:        false,
  hide_menu_counters:        false,
  hide_audio_ads:            false,
  hide_recent_groups:        false,
  hide_recommended_channels: false,
};

/**
 * Значения «очистки» для ключей без числового/булева дефолта (свободные
 * строки — цвет темы, акцент, шрифт, фон). При применении профиля эти ключи
 * сбрасываются именно к ним, иначе старый фон/тема «прилипли» бы к новому
 * профилю. '' — устоявшаяся в проекте конвенция «не задано» (см. кнопки
 * «Сбросить» в AccentColorSection / BackgroundSection).
 */
const CLEAR_VALUES: Record<string, unknown> = {
  custom_theme:             '',
  custom_accent:            '',
  custom_font_id:           '',
  custom_font_value:        '',
  avatar_radius_shape:      '',
  custom_theme_id:          '',
  custom_background:        '',
  background_type:          'image',
  background_overlay_color: '#000000',
};

export interface AppearanceProfile {
  id: string;
  name: string;
  createdAt: number;
  /** Только параметры, отличные от дефолта (результат captureAppearance). */
  settings: Record<string, unknown>;
}

/**
 * Снимок текущего оформления: только параметры, отличные от значений по
 * умолчанию. Тот же фильтр, что и collectShareParams, НО без отбрасывания
 * фонов из файловой системы расширения — локальный профиль их сохраняет.
 */
export function captureAppearance(settings: Settings): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  APPEARANCE_KEYS.forEach(key => {
    const val = settings[key] as unknown;
    if (val === undefined || val === null || val === '') return;
    if (key in DEFAULTS && val === DEFAULTS[key]) return;
    if (val === false) return;
    out[key] = val;
  });

  return out;
}

/** Кол-во активных (не-дефолтных) параметров оформления. */
export function countAppearanceParams(settings: Settings): number {
  return Object.keys(captureAppearance(settings)).length;
}

/**
 * Патч для применения профиля: сначала ВСЕ ключи оформления сбрасываются к
 * дефолту/очистке, затем накладываются значения профиля. Так применение —
 * полная замена оформления, без остатков от предыдущего профиля.
 */
export function buildApplyPatch(profileSettings: Record<string, unknown>): Settings {
  const patch: Settings = {};

  APPEARANCE_KEYS.forEach(key => {
    if (key in DEFAULTS) patch[key] = DEFAULTS[key];
    else if (key in CLEAR_VALUES) patch[key] = CLEAR_VALUES[key];
    else patch[key] = '';
  });

  return { ...patch, ...profileSettings };
}

/** Совпадает ли текущее оформление со снимком профиля (для индикатора «активен»). */
export function matchesProfile(current: Settings, profile: AppearanceProfile): boolean {
  const snap = captureAppearance(current);
  const snapKeys = Object.keys(snap);
  const profileKeys = Object.keys(profile.settings);

  if (snapKeys.length !== profileKeys.length) return false;
  // Значения — примитивы (строки/числа/булевы), достаточно строгого сравнения.
  return snapKeys.every(k => snap[k] === profile.settings[k]);
}
