import { expect, it } from 'vitest';
import { suppressSidebarAdLoading } from './sidebar-ad-flags.js';

it('disables only the native sidebar loader and restores the latest original configuration', () => {
  let enabled = true;
  const target = { vk: { pe: { 'frontend.tgb_disabled': 0, 'other': 1 } } };
  const stop = suppressSidebarAdLoading(target, () => enabled);
  expect(target.vk.pe['frontend.tgb_disabled']).toBe(true);
  expect(target.vk.pe.other).toBe(1);
  enabled = false; expect(target.vk.pe['frontend.tgb_disabled']).toBe(0);
  enabled = true;
  target.vk.pe['frontend.tgb_disabled'] = 1;
  target.vk = { pe: { 'frontend.tgb_disabled': 0, other: 2 } };
  expect(target.vk.pe['frontend.tgb_disabled']).toBe(true);
  stop(); expect(target.vk.pe['frontend.tgb_disabled']).toBe(0);
  expect(Object.getOwnPropertyDescriptor(target.vk.pe, 'frontend.tgb_disabled')?.get).toBeUndefined();
});
it('handles configuration arriving later and leaves immutable page-owned flags intact', () => {
  const target: { vk?: { pe: Record<string, unknown> } } = {};
  const stop = suppressSidebarAdLoading(target, () => true);
  target.vk = { pe: {} };
  expect(target.vk.pe['frontend.tgb_disabled']).toBe(true);
  stop(); expect('frontend.tgb_disabled' in target.vk.pe).toBe(false);
  const flags = Object.defineProperty({}, 'frontend.tgb_disabled', { value: false, configurable: false });
  const undo = suppressSidebarAdLoading({ vk: { pe: flags } }, () => true);
  expect(Reflect.get(flags, 'frontend.tgb_disabled')).toBe(false); undo();
});
