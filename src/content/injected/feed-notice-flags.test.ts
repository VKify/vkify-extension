import { expect, it } from 'vitest';
import { suppressFeedNoticeFlags } from './feed-notice-flags.js';

const peFlag = 'frontend.feed_replaced_item_notify';
const toggleFlag = 'feed_replaced_item_notify';
const statsFlag = 'frontend.feed_replaced_items_stats';

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
