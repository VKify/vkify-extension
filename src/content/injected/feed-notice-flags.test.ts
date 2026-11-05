import { expect, it } from 'vitest';
import { suppressFeedNoticeFlags } from './feed-notice-flags.js';

const peFlag = 'frontend.feed_replaced_item_notify';
const toggleFlag = 'feed_replaced_item_notify';
const statsFlag = 'frontend.feed_replaced_items_stats';

it('prevents search placement and profile browser banner initialization with the browser promo setting', () => {
  let menu = true;
  const profile = 'frontend.vkconnect_profile_menu_ya_browser_banner_enabled';
  const placements = ['feed_search_ya_bro_p1', 'feed_search_ya_bro_p2', 'feed_search_ya_bro_p3'];
  const target = { vk: { pe: { [profile]: true, 'frontend.vkconnect_profile_menu_ad_banner_enabled': true },
    toggles: Object.fromEntries(placements.map(key => [key, { abGroupId: 1 }])) } };
  const restore = suppressFeedNoticeFlags(target, () => false, { feed: () => false, menu: () => menu });
  const searchPosition = () => target.vk.toggles[placements[0]] ? 1 : target.vk.toggles[placements[1]] ? 3 : target.vk.toggles[placements[2]] ? 5 : null;
  expect(searchPosition()).toBeNull();
  expect(target.vk.pe[profile]).toBe(false);
  expect(target.vk.pe['frontend.vkconnect_profile_menu_ad_banner_enabled']).toBe(true);
  target.vk.toggles = Object.fromEntries(placements.map(key => [key, { abGroupId: 2 }]));
  expect(searchPosition()).toBeNull();
  menu = false;
  expect(searchPosition()).toBe(1);
  expect(target.vk.pe[profile]).toBe(true);
  menu = true;
  restore();
  expect(target.vk.toggles[placements[0]]).toEqual({ abGroupId: 2 });
  expect(target.vk.pe[profile]).toBe(true);
});

it('suppresses browser promo startup flags independently of feed ad blocking', () => {
  let feed = true, menu = false;
  const target = { vk: { pe: {
    'frontend.invite_promo_menu_item_enabled': true,
    'frontend.invite_promo_menu_item_custom_enabled': true,
    'frontend.invite_promo_modal_enabled': true, [statsFlag]: true,
  }, toggles: { feed_yandex_browser: { abGroupId: 1 }, unrelated: true } } };
  const restore = suppressFeedNoticeFlags(target, () => false, { feed: () => feed, menu: () => menu });
  expect(target.vk.toggles.feed_yandex_browser).toBe(false);
  expect(target.vk.pe['frontend.invite_promo_modal_enabled']).toBe(true);
  menu = true;
  for (const key of Object.keys(target.vk.pe).filter(key => key.includes('invite_promo'))) {
    expect(Reflect.get(target.vk.pe, key)).toBe(false);
  }
  expect(target.vk.pe[statsFlag]).toBe(true);
  expect(target.vk.toggles.unrelated).toBe(true);
  feed = false;
  expect(target.vk.toggles.feed_yandex_browser).toEqual({ abGroupId: 1 });
  restore();
  expect(target.vk.pe['frontend.invite_promo_modal_enabled']).toBe(true);
});

it('suppresses hidden-item observation flags and restores them on disable and teardown', () => {
  let enabled = true;
  const target = { vk: { pe: { [statsFlag]: true, unrelated: true } } };
  const restore = suppressFeedNoticeFlags(target, () => enabled);
  expect(target.vk.pe[statsFlag]).toBe(false);
  expect(target.vk.pe.unrelated).toBe(true);
  target.vk.pe = { [statsFlag]: true, unrelated: false };
  expect(target.vk.pe[statsFlag]).toBe(false);
  enabled = false;
  expect(target.vk.pe[statsFlag]).toBe(true);
  expect(target.vk.pe.unrelated).toBe(false);
  enabled = true;
  restore();
  expect(target.vk.pe[statsFlag]).toBe(true);
  expect(Object.getOwnPropertyDescriptor(target.vk.pe, statsFlag)?.get).toBeUndefined();
});

it('disables both notify branches only while blocking is enabled and restores latest VK values', () => {
  let enabled = false;
  const target = { vk: { pe: { [peFlag]: true, unrelated: true }, toggles: { [toggleFlag]: { abGroupId: 1 } } } };
  const restore = suppressFeedNoticeFlags(target, () => enabled);
  const canNotify = () => !!target.vk.pe[peFlag] || !!target.vk.toggles[toggleFlag];
  expect(canNotify()).toBe(true);
  enabled = true;
  expect(canNotify()).toBe(false);
  expect(target.vk.pe.unrelated).toBe(true);
  target.vk.toggles[toggleFlag] = { abGroupId: 2 };
  expect(canNotify()).toBe(false);
  enabled = false;
  expect(target.vk.toggles[toggleFlag]).toEqual({ abGroupId: 2 });
  enabled = true;
  restore();
  expect(canNotify()).toBe(true);
  expect(Object.getOwnPropertyDescriptor(target.vk.pe, peFlag)?.get).toBeUndefined();
  expect(target.vk.toggles[toggleFlag]).toEqual({ abGroupId: 2 });
});

it('handles late bootstrap and SPA config replacement without disabling other flags', () => {
  const target: { vk?: { pe?: Record<string, unknown>; toggles?: Record<string, unknown> } } = {};
  const restore = suppressFeedNoticeFlags(target, () => true);
  target.vk = {};
  target.vk.pe = { [peFlag]: true, other: 1 };
  target.vk.toggles = { [toggleFlag]: true };
  expect(target.vk.pe[peFlag]).toBe(false);
  target.vk = { pe: { [peFlag]: true }, toggles: { [toggleFlag]: true } };
  expect(target.vk.toggles![toggleFlag]).toBe(false);
  restore();
  expect(target.vk.pe![peFlag]).toBe(true);
  expect(Object.getOwnPropertyDescriptor(target, 'vk')?.get).toBeUndefined();
});

it('leaves immutable configuration intact for the DOM fallback', () => {
  const pe = Object.freeze({ [peFlag]: true });
  const target = { vk: { pe } };
  const restore = suppressFeedNoticeFlags(target, () => true);
  expect(target.vk.pe[peFlag]).toBe(true);
  restore();
});
