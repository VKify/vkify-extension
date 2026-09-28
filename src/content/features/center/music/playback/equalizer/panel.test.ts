// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { storage } from '@/content/core/storage.js';
import { openPanel, closePanel, destroyPanel, isPanelOpen } from './panel.js';

const values: Record<string, unknown> = {};
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
beforeEach(() => {
  storage.cleanup(); storage.invalidateCache();
  for (const key of Object.keys(values)) delete values[key];
  values.audio_equalizer = true;
  vi.stubGlobal('chrome', { runtime: { id: 'test' }, storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | null) => keys === null ? { ...values } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => k in values).map(k => [k, values[k]]))),
      set: vi.fn(async (patch: Record<string, unknown>) => { Object.assign(values, patch); }),
    }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  } });
});
afterEach(() => { destroyPanel(); storage.cleanup(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
it('keeps one panel through close, reopen and SPA reattachment without disabling DSP', async () => {
  await openPanel(); await flush();
  const root = document.querySelector<HTMLElement>('[data-vkify-widget="equalizer"]')!;
  expect(root.querySelectorAll('input[type="range"]')).toHaveLength(11);
  closePanel(); expect(root.classList.contains('is-hidden')).toBe(true);
  expect(isPanelOpen()).toBe(false); expect(values.audio_equalizer).toBe(true);
  await openPanel(); root.remove(); await openPanel();
  expect(root.isConnected).toBe(true); expect(root.classList.contains('is-hidden')).toBe(false);
  expect(document.querySelectorAll('[data-vkify-widget="equalizer"]')).toHaveLength(1);
  destroyPanel(); await flush(); expect(root.isConnected).toBe(false);
});
it('does not mount after destroy interrupts loading settings', async () => {
  const opening = openPanel(); destroyPanel(); await opening; await flush();
  expect(document.querySelector('[data-vkify-widget="equalizer"]')).toBeNull();
});
