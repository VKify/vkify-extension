import { describe, expect, it } from 'vitest';
import { APPEARANCE_KEYS, buildApplyPatch, captureAppearance, matchesProfile } from '../popup/utils/appearanceProfile.js';
import { collectShareParams, encodeThemeSettings } from '../popup/utils/themeShare.js';
import { THEME_KEYS, buildThemePatch } from '../shared/constants/appearance.js';
import { isValidSettingValue, SETTINGS_SCHEMA, THEME_SHORT_EXPAND } from '../shared/constants/settings-schema.js';
import { BUILTIN_PRESETS } from '../shared/constants/presets.js';
import { buildPresetApplyPatch, buildPresetDisablePatch, isPresetActive } from '../popup/utils/presets.js';

const fixture = {
  clock_enabled: true, clock_settings: '{}', music_visualizer: true,
  music_visualizer_settings: '{"opacity":0.4}', music_lyrics: true,
  music_lyrics_settings: '{}', web_wallpaper_id: 'aurora',
  web_wallpaper_schema: '[]', web_wallpaper_values: '{"aurora":{"speed":2}}',
  hide_feed_right_column: true, hide_profile_right_column: true,
  hide_stories_discover: true, hide_promo_link: true,
  hide_open_profile_block: true,
  hide_profile_friends_recommendations: true, hidden_menu_items: ['l_aud'],
  communities_swap_columns: true, profile_swap_columns: true,
  page_offset_value: 0, custom_font_value: '"Шрифт", sans-serif',
  custom_background: 'https://vkify.ru/wallpapers/web/aurora', background_type: 'web' as const,
  custom_css: '.page { color: red; }', custom_css_enabled: true,
  prevent_read: true, telegram_bot_token: 'secret',
};

describe('appearance snapshots and portable themes', () => {
  it('captures new features, empty menu overrides and local CSS, then restores an identical profile', () => {
    const snapshot = captureAppearance(fixture);
    expect(snapshot).toMatchObject({ clock_enabled: true, music_lyrics: true, music_visualizer: true, hidden_menu_items: ['l_aud'], web_wallpaper_values: fixture.web_wallpaper_values, custom_css: fixture.custom_css, page_offset_value: 0 });
    expect(snapshot).not.toHaveProperty('prevent_read');
    expect(snapshot).not.toHaveProperty('telegram_bot_token');
    expect(matchesProfile(buildApplyPatch(snapshot), { id: 'test', name: 'Test', createdAt: 1, settings: snapshot })).toBe(true);
    expect(APPEARANCE_KEYS).toEqual(expect.arrayContaining([...THEME_KEYS]));
  });

  it('generates a Unicode-safe URL with the exact preview parameters accepted by the receiver', () => {
    const encoded = encodeThemeSettings(fixture)!;
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
    const decoded = Object.fromEntries(Object.entries(payload.p).map(([key, value]) => [THEME_SHORT_EXPAND[key] ?? key, value]));
    expect(decoded).toEqual(Object.fromEntries(collectShareParams(fixture).map(p => [p.key, p.value])));
    expect(decoded).not.toHaveProperty('custom_css');
    expect(decoded).not.toHaveProperty('telegram_bot_token');
    expect(decoded).toMatchObject({ hidden_menu_items: ['l_aud'], clock_enabled: true, page_offset_value: 0 });
    for (const [key, value] of Object.entries(decoded)) expect(isValidSettingValue(key, value, 'theme'), key).toBe(true);
  });

  it('resets omitted features to valid defaults without changing privacy', () => {
    const patch = buildThemePatch({ custom_accent: '#0077ff' });
    expect(patch).toMatchObject({ music_visualizer: false, clock_enabled: false, web_wallpaper_values: '{}', content_width: 1100 });
    for (const key of THEME_KEYS) expect(isValidSettingValue(key, patch[key], 'theme'), key).toBe(true);
    expect(patch).not.toHaveProperty('prevent_read');
    expect(buildApplyPatch({ prevent_read: false })).not.toHaveProperty('prevent_read');
  });

  it('excludes invalid values and inaccessible backgrounds and rejects oversized links', () => {
    expect(collectShareParams({ custom_background: 'chrome-extension://id/bg.png', clock_settings: 'bad', hidden_menu_items: ['unknown'] })).toEqual([]);
    expect(encodeThemeSettings(Object.fromEntries(['custom_theme', 'custom_accent'].map(key => [key, 'x'.repeat(65536)])))).toBeNull();
  });

  it('keeps all preset resets valid and includes new privacy and performance features', () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(isPresetActive(preset, buildPresetApplyPatch(preset))).toBe(true);
      for (const patch of [buildPresetApplyPatch(preset), buildPresetDisablePatch(preset)]) {
        for (const [key, value] of Object.entries(patch)) {
          if (SETTINGS_SCHEMA[key]?.scopes.includes('theme')) expect(isValidSettingValue(key, value, 'theme'), key).toBe(true);
        }
      }
    }
    expect(BUILTIN_PRESETS.find(p => p.id === 'preset_privacy')!.settings.prevent_story_views).toBe(true);
    expect(BUILTIN_PRESETS.find(p => p.id === 'preset_performance')!.settings.music_visualizer).toBe(false);
  });
});
