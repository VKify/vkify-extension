import { keysForScope, SETTINGS_SCHEMA } from './settings-schema.js';
import { DEFAULT_SETTINGS } from './defaults.js';

/** Portable appearance keys come from the same schema as theme application. */
export const THEME_KEYS: readonly string[] = keysForScope('theme');

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
  hide_friends_suggestions:  false,
  hide_emoji_status:         false,
  hide_mini_chat:            false,
  hide_scroll_top:           false,
  hide_menu_settings:        false,
  hide_menu_counters:        false,
  hide_recent_groups:        false,
  hide_recommended_channels: false,
  hide_channels_tab:         false,
  hide_business_notifications: false,
};

/**
 * Значения «очистки» для ключей без числового/булева дефолта (свободные
 * строки — цвет темы, акцент, шрифт, фон). При применении профиля эти ключи
 * сбрасываются именно к ним, иначе старый фон/тема «прилипли» бы к новому
 * профилю. '' — устоявшаяся в проекте конвенция «не задано» (см. кнопки
 * «Сбросить» в AccentColorSection / BackgroundSection).
 */
export const CLEAR_VALUES: Record<string, unknown> = {
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


Object.assign(DEFAULTS, {
  content_width: DEFAULT_SETTINGS.content_width,
  clock_enabled: false, clock_settings: '{}',
  music_lyrics: false, music_lyrics_settings: '{}',
  music_visualizer: false, music_visualizer_settings: '{}',
  hidden_menu_items: DEFAULT_SETTINGS.hidden_menu_items,
  menu_items_order: DEFAULT_SETTINGS.menu_items_order,
});
Object.assign(CLEAR_VALUES, {
  web_wallpaper_id: '', web_wallpaper_schema: '[]', web_wallpaper_values: '{}',
});

export function appearanceDefault(key: string): unknown {
  if (key in DEFAULTS) return DEFAULTS[key];
  if (key in CLEAR_VALUES) return CLEAR_VALUES[key];
  return SETTINGS_SCHEMA[key]?.type === 'boolean' ? false : '';
}

export function buildThemePatch(settings: Record<string, unknown>): Record<string, unknown> {
  return { ...Object.fromEntries(THEME_KEYS.map(key => [key, appearanceDefault(key)])), ...settings };
}
