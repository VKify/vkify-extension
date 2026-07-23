import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIDDEN_MENU_ITEM_IDS,
  MENU_ITEM_IDS,
  MENU_ITEMS,
  selectorsForMenuItem,
} from '@/shared/constants/menu-items.js';
import { buildHiddenMenuItemsCss } from './hide-menu-items.js';

describe('left menu item config', () => {
  it('declares a unique, non-empty selector list for every managed item', () => {
    expect(new Set(MENU_ITEM_IDS).size).toBe(MENU_ITEM_IDS.length);
    expect(MENU_ITEMS.every((item) => item.selectors.length > 0)).toBe(true);
  });

  it('contains the Yandex Browser promo selector', () => {
    expect(selectorsForMenuItem('l_invite_promo')).toEqual(['#l_invite_promo']);
    expect(DEFAULT_HIDDEN_MENU_ITEM_IDS).toContain('l_invite_promo');
  });
});

describe('buildHiddenMenuItemsCss', () => {
  it('builds CSS from the shared config', () => {
    expect(buildHiddenMenuItemsCss(['l_invite_promo', 'sep_main'])).toBe(
      '#l_invite_promo{display:none!important}'
      + 'div[class*="eparator"]:has(+ #l_mini_apps){display:none!important}',
    );
  });

  it('ignores unknown, malformed and duplicate values', () => {
    expect(buildHiddenMenuItemsCss(['l_pr', 'l_pr', 'unknown', 42])).toBe(
      '#l_pr{display:none!important}',
    );
    expect(buildHiddenMenuItemsCss('l_pr')).toBeNull();
  });
});
