import { describe, expect, it } from 'vitest';
import { MENU_ITEM_IDS, normalizeMenuOrder } from '@/shared/constants/menu-items.js';
import { isValidSettingValue } from '@/shared/constants/settings-schema.js';
import { buildMenuOrderCss } from './menu-items-order.js';
import { buildHiddenMenuItemsCss } from './hide-menu-items.js';

describe('menu ordering', () => {
  it('retains saved positions and appends missing items once', () => {
    const order = normalizeMenuOrder(['l_vkify_settings', 'l_aud', 'l_aud', 'unknown', 3]);
    expect(order.slice(0, 2)).toEqual(['l_vkify_settings', 'l_aud']);
    expect(new Set(order)).toEqual(new Set(MENU_ITEM_IDS));
    expect(order).toHaveLength(MENU_ITEM_IDS.length);
    expect(normalizeMenuOrder(undefined)).toEqual(MENU_ITEM_IDS);
  });

  it('can order the settings link and separators and restore native ordering', () => {
    const css = buildMenuOrderCss(['l_vkify_settings', 'sep_main', 'l_aud']);
    expect(css).toContain('>#l_vkify_settings{order:0!important}');
    expect(css).toContain('>div[class*="eparator"]:has(+ #l_mini_apps){order:1!important}');
    expect(css).toContain('>#l_aud{order:2!important}');
    expect(buildMenuOrderCss([])).toBeNull();
    expect(buildMenuOrderCss(null)).toBeNull();
    expect(buildHiddenMenuItemsCss(['l_vkify_settings'])).toBe('#l_vkify_settings{display:none!important}');
  });

  it('validates order at import and theme boundaries', () => {
    for (const scope of ['import', 'theme', 'siteWrite'] as const) {
      expect(isValidSettingValue('menu_items_order', ['l_vkify_settings', 'l_pr'], scope)).toBe(true);
      expect(isValidSettingValue('menu_items_order', [], scope)).toBe(true);
      expect(isValidSettingValue('menu_items_order', ['l_pr', 'l_pr'], scope)).toBe(false);
      expect(isValidSettingValue('menu_items_order', ['body{}'], scope)).toBe(false);
    }
  });
});
