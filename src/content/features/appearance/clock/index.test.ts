// @vitest-environment happy-dom
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createClockFeature } from './index.js';
import { compileFeatureDefinition } from '@/content/core/features/index.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { CssManager } from '@/content/core/css-manager.js';

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 27, 23, 48, 59));
  vi.stubGlobal('chrome', { runtime: { id: 'test', onMessage: { addListener: vi.fn(), removeListener: vi.fn() } } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

function fixture() {
  const css = new CssManager();
  const values: Record<string, unknown> = { clock_enabled: true, clock_settings: '{}' };
  const callbacks = new Map<string, () => void>();
  const ctx = {
    getSetting: vi.fn(async (key: string) => values[key]),
    setSetting: vi.fn(async (key: string, value: unknown) => { values[key] = value; callbacks.get(key)?.(); }),
    onSettingChange: (key: string, callback: () => void) => { callbacks.set(key, callback); return () => callbacks.delete(key); },
    injectCSS: (id: string, source: string) => css.inject(id, source), removeCSS: (id: string) => css.remove(id),
  } as unknown as FeatureContext;
  const def = createClockFeature(ctx);
  return { values, callbacks, ctx, def, handler: compileFeatureDefinition(def, ctx).handler };
}

it('updates the same node through all VK SPA routes, settings and reattachment; cleans up', async () => {
  const { handler, values, def, callbacks } = fixture();
  expect(def.reapplyOnNavigate).toBe(true);
  await handler.enable?.();
  const first = document.getElementById('vkify-clock')!;
  expect(first.textContent).toBe('23:48');
  for (const path of ['/feed', '/im', '/music', '/id123', '/club123', '/video']) {
    history.replaceState({}, '', path);
    await handler.enable?.();
    expect(document.querySelectorAll('#vkify-clock')).toHaveLength(1);
    expect(document.getElementById('vkify-clock')).toBe(first);
  }
  first.remove(); await handler.enable?.(); expect(first.isConnected).toBe(true);
  values.clock_settings = '{"seconds":true,"hour12":true}';
  callbacks.get('clock_settings')?.();
  await vi.advanceTimersByTimeAsync(0);
  expect(first.textContent).toBe('11:48:59 PM');
  await vi.advanceTimersByTimeAsync(1000);
  expect(first.textContent).toBe('11:49:00 PM');
  expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  await handler.disable?.();
  expect(document.getElementById('vkify-clock')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  expect(callbacks.size).toBe(0);
  expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledTimes(1);
});

it('enters opt-in drag mode, persists once on release, and closes with Escape', async () => {
  const { handler, ctx } = fixture(); await handler.enable?.();
  const element = document.getElementById('vkify-clock')!;
  Object.assign(element, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() });
  const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0];
  listener({ type: 'VKIFY_CLOCK_EDIT' }, { id: 'test' }, vi.fn());
  expect(element.style.pointerEvents).toBe('auto');
  element.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0 }));
  element.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 300, clientY: 200 }));
  expect(ctx.setSetting).not.toHaveBeenCalled();
  element.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  expect(ctx.setSetting).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(vi.mocked(ctx.setSetting).mock.calls[0][1]))).toMatchObject({ position: 'custom' });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(element.style.pointerEvents).toBe('none');
  expect(document.querySelector('.vkify-clock-toolbar')).toBeNull();
  await handler.disable?.();
});
