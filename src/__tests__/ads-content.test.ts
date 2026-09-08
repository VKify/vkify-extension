import { describe, expect, it } from 'vitest';
import { ADS_CONTENT_SETTINGS } from '../shared/constants/ads-content.js';
import { ADS_PROTECTION_SETTINGS } from '../shared/constants/ads-protection.js';
import { DEFAULT_SETTINGS, RESET_SETTINGS } from '../shared/constants/defaults.js';
import { migrateV8ToV9 } from '../shared/storage/migrations/migrate_v8_to_v9.js';
import { migrateV9ToV10 } from '../shared/storage/migrations/migrate_v9_to_v10.js';
import { isValidSettingValue } from '../shared/constants/settings-schema.js';

describe('ads content settings', () => {
  it('enables every category on installation and reset, and includes it in protection', () => {
    for (const key of ADS_CONTENT_SETTINGS) {
      expect(DEFAULT_SETTINGS[key]).toBe(true);
      expect(RESET_SETTINGS[key]).toBe(true);
      expect(ADS_PROTECTION_SETTINGS).toContain(key);
      expect(isValidSettingValue(key, false, 'import')).toBe(true);
      expect(isValidSettingValue(key, false, 'theme')).toBe(false);
    }
  });

  it.each([true, false])('preserves the old recommendation choice (%s) independently of music', (value) => {
    const old = { hide_recommendations: value, hide_audio_ads: !value, custom_theme: 'dark' };
    const next = migrateV8ToV9.migrate(old);
    for (const key of ADS_CONTENT_SETTINGS.filter(key => key.startsWith('block_recommendations_') && key !== 'block_recommendations_communities')) {
      expect(next[key]).toBe(value);
    }
    expect(next.block_music_ads).toBe(!value);
    expect(next.custom_theme).toBe('dark');
    expect(next).not.toHaveProperty('hide_recommendations');
    expect(next).not.toHaveProperty('hide_audio_ads');
    expect(old.hide_recommendations).toBe(value);
  });

  it('defaults missing or invalid legacy values to hiding', () => {
    for (const old of [{}, { hide_recommendations: 'false', hide_audio_ads: null }]) {
      const next = migrateV8ToV9.migrate(old);
      for (const key of ADS_CONTENT_SETTINGS.filter(key => !['block_recommendations_communities', 'block_yandex_browser_promo'].includes(key))) expect(next[key]).toBe(true);
    }
  });

  it('preserves new per-section choices and is idempotent', () => {
    const next = migrateV8ToV9.migrate({
      hide_recommendations: true,
      hide_audio_ads: true,
      block_recommendations_games: false,
      block_music_ads: false,
    });
    expect(next.block_recommendations_games).toBe(false);
    expect(next.block_music_ads).toBe(false);
    expect(migrateV8ToV9.migrate(next)).toEqual(next);
  });
});

describe('community recommendations and menu promo migration', () => {
  it.each(['l_invite_promo', 'l_invite_menu_promo'])('moves the hidden promo (%s) without changing other menu items', (id) => {
    const old = { hidden_menu_items: ['l_pr', id, 'sep_main'] };
    const next = migrateV9ToV10.migrate(old);
    expect(next.block_yandex_browser_promo).toBe(true);
    expect(next.block_recommendations_communities).toBe(true);
    expect(next.hidden_menu_items).toEqual(['l_pr', 'sep_main']);
    expect(old.hidden_menu_items).toEqual(['l_pr', id, 'sep_main']);
    expect(migrateV9ToV10.migrate(next)).toEqual(next);
  });

  it('preserves an explicitly visible menu promo', () => {
    expect(migrateV9ToV10.migrate({ hidden_menu_items: [] }).block_yandex_browser_promo).toBe(false);
  });

  it('defaults missing menu settings to hidden and preserves new choices', () => {
    expect(migrateV9ToV10.migrate({}).block_yandex_browser_promo).toBe(true);
    const next = migrateV9ToV10.migrate({
      block_yandex_browser_promo: false,
      block_recommendations_communities: false,
      hidden_menu_items: ['l_invite_promo', 'l_invite_menu_promo'],
    });
    expect(next.block_yandex_browser_promo).toBe(false);
    expect(next.block_recommendations_communities).toBe(false);
    expect(next.hidden_menu_items).toEqual([]);
  });
});
