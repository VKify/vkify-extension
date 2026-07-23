/**
 * SINGLE SOURCE OF TRUTH for every user-facing setting that can cross a trust
 * boundary. Before this file, the same security allowlist was hand-maintained
 * in FOUR places that had already drifted apart:
 *
 *   - message-handler.ts   THEME_KEY_SCHEMA + SHORT_KEY_EXPAND + isValidThemeValue
 *   - SettingsContext.tsx  IMPORTABLE_KEYS + CSS_STRING_KEYS + sanitizeImportedSettings
 *   - site-bridge.ts       WRITABLE_KEYS
 *   - site-bridge.ts       EXPOSED_KEYS
 *
 * Each key is declared exactly once, with its value `type` and the set of
 * trust boundaries (`scopes`) it may legitimately cross. Every allowlist and
 * BOTH validators are now derived from this table, so adding/changing a
 * feature is one edit and cannot desync.
 *
 * Scopes:
 *   theme      — accepted from a shared-theme URL (background → handleApplySharedTheme)
 *   import     — accepted from a user-imported settings JSON file (popup)
 *   siteWrite  — accepted from vkify.ru via the site-bridge (site → extension)
 *   siteExpose — read-only: announced back to vkify.ru by the site-bridge
 *
 * `short` is the compact alias used in v2 shared-theme URLs.
 *
 * NOTE: classic scripts (site-bridge) import this directly — that is only
 * possible because each classic entry is now built as a self-contained IIFE
 * (see vite.config.ts). Do not reintroduce hand-copied allowlists.
 */

export type SettingScope = 'theme' | 'import' | 'siteWrite' | 'siteExpose';

/** A primitive type tag, or a readonly array = the exact set of allowed string values. */
export type SettingValueSpec = 'string' | 'number' | 'boolean' | readonly string[];

export interface SettingSpec {
  readonly type: SettingValueSpec;
  readonly scopes: readonly SettingScope[];
  readonly short?: string;
  readonly validate?: (value: unknown) => boolean;
}

/** 64 KB cap on any string value, on every boundary. */
export const MAX_SETTING_STRING_LENGTH = 65536;

/**
 * Values interpolated into generated CSS need stricter validation than a
 * generic string. These helpers are exported so the final DOM sinks can also
 * defend old/directly-written storage values, not only boundary traffic.
 */
export function isSafeFontFamily(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 512) return false;
  return !/[\u0000-\u001f\u007f;{}@]|\/\*|\*\/|url\s*\(/i.test(value);
}

export function isSafeCssColor(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 128) return false;
  if (!value) return true;
  return !/[\u0000-\u001f\u007f;{}@]|\/\*|\*\/|(?:url|image|image-set|var)\s*\(/i.test(value);
}

/**
 * Backgrounds may be remote URLs or locally uploaded data URLs. Active
 * document formats (HTML/SVG/XML) are intentionally rejected: a shared theme
 * can otherwise turn a decorative background into an executable iframe when
 * background_type is "web".
 */
export function isSafeBackgroundResource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const input = value.trim();
  if (!input) return true;

  if (/^data:/i.test(input)) {
    return /^data:(?:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)|video\/(?:mp4|webm|ogg))(?:;[a-z0-9!#$&^_.+-]+=[^;,]*)*(?:;base64)?,/i.test(input);
  }

  try {
    const url = new URL(input);
    if (url.username || url.password) return false;
    return ['http:', 'https:', 'chrome-extension:', 'moz-extension:'].includes(url.protocol);
  } catch {
    return false;
  }
}

const numberBetween = (min: number, max: number) =>
  (value: unknown): boolean => typeof value === 'number' && value >= min && value <= max;

// Enum value sets MUST match what the popup UI actually emits.
// background_position / background_size mirror BACKGROUND_POSITIONS /
// BACKGROUND_SIZES in src/popup/constants/appearance.ts — the old hand-copied
// CSS_STRING_KEYS was wrong here (rejected real values like 'top center').
const BG_POSITION = ['center', 'top center', 'bottom center', 'center left', 'center right'] as const;
const BG_SIZE = ['cover', 'contain', 'auto', '100% 100%'] as const;
const BG_TYPE = ['image', 'video', 'embed', 'web'] as const;
const FONT_STYLE = ['normal', 'italic', 'oblique'] as const;
const TEXT_DECORATION = ['none', 'underline', 'overline', 'line-through'] as const;
const TEXT_TRANSFORM = ['none', 'capitalize', 'uppercase', 'lowercase'] as const;
const EXT_THEME = ['light', 'dark', 'auto'] as const;
const AVATAR_SHAPE = ['drop', 'leaf', 'petal', 'blob'] as const;

// Scope presets to keep the table readable and consistent.
const TH = ['theme', 'import', 'siteWrite'] as const;                 // theme key (not exposed back)
const THX = ['theme', 'import', 'siteWrite', 'siteExpose'] as const;  // theme key, exposed back
const ADX = ['import', 'siteWrite', 'siteExpose'] as const;           // ads/privacy toggle, exposed
const IMP = ['import'] as const;                                      // import-only

export const SETTINGS_SCHEMA: Readonly<Record<string, SettingSpec>> = {
  // ── Theme ───────────────────────────────────────────────────────────────
  custom_theme:             { type: 'string', scopes: THX, short: 'ct' },
  custom_accent:            { type: 'string', scopes: THX, short: 'ca' },
  custom_theme_id:          { type: 'string', scopes: THX, short: 'ti' },
  block_opacity:            { type: 'number', scopes: TH,  short: 'bo', validate: numberBetween(0, 1) },
  glass_blur:               { type: 'number', scopes: TH,  short: 'gb', validate: numberBetween(0, 100) },
  theme_radius:             { type: 'number', scopes: TH,  short: 'tr', validate: numberBetween(0, 100) },
  block_depth:              { type: 'boolean', scopes: TH, short: 'bd' },

  // ── Font ────────────────────────────────────────────────────────────────
  custom_font_id:           { type: 'string',         scopes: THX, short: 'fi' },
  custom_font_value:        { type: 'string',         scopes: TH,  short: 'fv', validate: isSafeFontFamily },
  custom_font_size:         { type: 'number',         scopes: TH,  short: 'fs', validate: numberBetween(0, 100) },
  custom_line_height:       { type: 'number',         scopes: TH,  short: 'lh', validate: numberBetween(-20, 50) },
  custom_letter_spacing:    { type: 'number',         scopes: TH,  short: 'ls', validate: numberBetween(-2, 5) },
  custom_font_weight:       { type: 'number',         scopes: TH,  short: 'fw', validate: numberBetween(0, 1000) },
  custom_font_style:        { type: FONT_STYLE,       scopes: TH,  short: 'fy' },
  custom_text_decoration:   { type: TEXT_DECORATION,  scopes: TH,  short: 'td' },
  custom_text_transform:    { type: TEXT_TRANSFORM,   scopes: TH,  short: 'tm' },

  // ── Layout ──────────────────────────────────────────────────────────────
  border_radius:            { type: 'number',  scopes: THX, short: 'br', validate: numberBetween(0, 100) },
  avatar_radius_shape:      { type: AVATAR_SHAPE, scopes: TH, short: 'av' },
  content_width:            { type: 'number',  scopes: TH,  short: 'cw', validate: numberBetween(0, 5000) },
  content_width_enabled:    { type: 'boolean', scopes: TH,  short: 'cwe' },
  compact_spacing:          { type: 'boolean', scopes: THX, short: 'cp' },
  page_offset_enabled:      { type: 'boolean', scopes: TH,  short: 'pe' },
  page_offset_value:        { type: 'number',  scopes: TH,  short: 'pv', validate: numberBetween(-500, 500) },

  // ── Display mode ────────────────────────────────────────────────────────
  minimalistic_sidebar:     { type: 'boolean', scopes: TH, short: 'ms' },
  fixed_sidebar:            { type: 'boolean', scopes: TH, short: 'fx' },
  sidebar_with_background:  { type: 'boolean', scopes: TH, short: 'sw' },
  collapse_search:          { type: 'boolean', scopes: TH, short: 'cs' },

  // ── Background ──────────────────────────────────────────────────────────
  custom_background:        { type: 'string',  scopes: THX, short: 'cb', validate: isSafeBackgroundResource },
  background_type:          { type: BG_TYPE,   scopes: THX, short: 'bt' },
  background_blur:          { type: 'number',  scopes: TH,  short: 'bl', validate: numberBetween(0, 100) },
  background_dim:           { type: 'number',  scopes: TH,  short: 'dm', validate: numberBetween(0, 100) },
  background_opacity:       { type: 'number',  scopes: TH,  short: 'op', validate: numberBetween(0, 100) },
  background_brightness:    { type: 'number',  scopes: TH,  short: 'bb', validate: numberBetween(0, 300) },
  background_contrast:      { type: 'number',  scopes: TH,  short: 'bc', validate: numberBetween(0, 300) },
  background_saturation:    { type: 'number',  scopes: TH,  short: 'bs', validate: numberBetween(0, 300) },
  background_scale:         { type: 'number',  scopes: TH,  short: 'bk', validate: numberBetween(10, 300) },
  background_hue_rotate:    { type: 'number',  scopes: TH,  short: 'bh', validate: numberBetween(-360, 360) },
  background_sepia:         { type: 'number',  scopes: TH,  short: 'bp', validate: numberBetween(0, 100) },
  background_grayscale:     { type: 'number',  scopes: TH,  short: 'bg', validate: numberBetween(0, 100) },
  background_position:      { type: BG_POSITION, scopes: TH, short: 'bx' },
  background_size:          { type: BG_SIZE,   scopes: TH,  short: 'bz' },
  background_overlay_color: { type: 'string',  scopes: TH,  short: 'oc', validate: isSafeCssColor },
  background_overlay_opacity: { type: 'number', scopes: TH, short: 'oo', validate: numberBetween(0, 100) },
  background_vignette:      { type: 'number',  scopes: TH,  short: 'bv', validate: numberBetween(0, 100) },
  background_video_speed:   { type: 'number',  scopes: TH,  short: 'vs', validate: numberBetween(10, 400) },
  background_video_volume:  { type: 'number',  scopes: TH,  short: 'vv', validate: numberBetween(0, 100) },

  // ── Visual filters ──────────────────────────────────────────────────────
  filter_grayscale:         { type: 'boolean', scopes: TH, short: 'fg' },
  filter_sepia:             { type: 'boolean', scopes: TH, short: 'fp' },
  filter_invert:            { type: 'boolean', scopes: TH, short: 'fn' },
  filter_dim_images:        { type: 'boolean', scopes: TH, short: 'di' },
  filter_high_contrast:     { type: 'boolean', scopes: TH, short: 'hc' },
  filter_low_brightness:    { type: 'boolean', scopes: TH, short: 'lb' },

  // ── Hidden elements ─────────────────────────────────────────────────────
  hide_stories:             { type: 'boolean', scopes: TH, short: 'hs' },
  hide_post_box:            { type: 'boolean', scopes: TH, short: 'hpb' },
  hide_post_comments:       { type: 'boolean', scopes: TH, short: 'hpc' },
  hide_feed_right_column:   { type: 'boolean', scopes: TH, short: 'hfrc' },
  hide_recommendations:     { type: 'boolean', scopes: TH, short: 'hd' },
  hide_friends_suggestions: { type: 'boolean', scopes: TH, short: 'hf' },
  hide_emoji_status:        { type: 'boolean', scopes: TH, short: 'he' },
  hide_stories_discover:    { type: 'boolean', scopes: TH, short: 'hsd' },
  hide_promo_link:          { type: 'boolean', scopes: TH, short: 'hpl' },
  hide_profile_right_column: { type: 'boolean', scopes: TH, short: 'hplc' },
  hide_mini_chat:           { type: 'boolean', scopes: TH, short: 'hm' },
  hide_scroll_top:          { type: 'boolean', scopes: TH, short: 'ht' },
  hide_menu_settings:       { type: 'boolean', scopes: TH, short: 'hg' },
  hide_menu_counters:       { type: 'boolean', scopes: TH, short: 'hmc' },
  hide_audio_ads:           { type: 'boolean', scopes: TH, short: 'haa' },
  hide_recent_groups:       { type: 'boolean', scopes: TH, short: 'hrg' },
  hide_recommended_channels:{ type: 'boolean', scopes: TH, short: 'hrc' },

  // ── Ads / privacy (not part of shared themes) ───────────────────────────
  extension_theme:          { type: EXT_THEME, scopes: ADX },
  block_left_ads:           { type: 'boolean', scopes: ADX },
  block_feed_ads_api:       { type: 'boolean', scopes: ADX },
  block_feed_ads_dom:       { type: 'boolean', scopes: ADX },
  block_trackers:           { type: 'boolean', scopes: ADX },

  // ── Import-only (machine/feature state, never site-writable) ────────────
  custom_css:               { type: 'string',  scopes: IMP },
  custom_css_enabled:       { type: 'boolean', scopes: IMP },
  blur_on_unfocus:          { type: 'boolean', scopes: IMP },
  widescreen:               { type: 'boolean', scopes: IMP },
  audio_download:           { type: 'boolean', scopes: IMP },
  audio_autoplay:           { type: 'boolean', scopes: IMP },
  audio_download_bitrate:   { type: ['128', '192', '320'] as const, scopes: IMP },
  audio_download_format:    { type: ['mp3', 'original'] as const, scopes: IMP },
  audio_download_filename:  { type: ['artist_title', 'title_artist', 'title'] as const, scopes: IMP },
  audio_download_id3:        { type: 'boolean', scopes: IMP },
  audio_download_lyrics:     { type: 'boolean', scopes: IMP },
};

/** All keys whose declared scopes include `scope`. */
export function keysForScope(scope: SettingScope): string[] {
  return Object.keys(SETTINGS_SCHEMA).filter(k => SETTINGS_SCHEMA[k].scopes.includes(scope));
}

/** Short-alias → full-key map for decoding v2 shared-theme URLs. */
export const THEME_SHORT_EXPAND: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SETTINGS_SCHEMA)
      .filter(([, s]) => s.short)
      .map(([key, s]) => [s.short as string, key]),
  ),
);

/** True iff `value` is a legitimate value for `key` crossing `scope`. */
export function isValidSettingValue(key: string, value: unknown, scope: SettingScope): boolean {
  // Own-property check: a bare `SETTINGS_SCHEMA[key]` would resolve inherited
  // members like "constructor"/"toString" to truthy Object.prototype values.
  if (!Object.prototype.hasOwnProperty.call(SETTINGS_SCHEMA, key)) return false;
  const spec = SETTINGS_SCHEMA[key];
  if (!spec.scopes.includes(scope)) return false;

  const { type } = spec;
  let valid = false;
  if (Array.isArray(type)) {
    valid = typeof value === 'string' && (type as readonly string[]).includes(value);
  } else if (type === 'string') {
    valid = typeof value === 'string' && value.length <= MAX_SETTING_STRING_LENGTH;
  } else if (type === 'number') {
    valid = typeof value === 'number' && Number.isFinite(value);
  } else if (type === 'boolean') {
    valid = typeof value === 'boolean';
  }
  return valid && (!spec.validate || spec.validate(value));
}

/**
 * Filters an untrusted object down to the entries that are valid for `scope`.
 * The single sanitizer used by the shared-theme, file-import, and site-bridge
 * paths. Built on a null-prototype object so a literal "__proto__" key in the
 * input cannot pollute Object.prototype.
 */
export function sanitizeSettings(
  raw: Record<string, unknown>,
  scope: SettingScope,
): Record<string, unknown> {
  const out: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (isValidSettingValue(key, value, scope)) out[key] = value;
  }
  // Return a plain object so consumers (chrome.storage, JSON) behave normally.
  return { ...out };
}
