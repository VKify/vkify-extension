// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FloatingWidgetHandle } from './floating-widget.js';
import { createWidgetFeature } from './create-widget-feature.js';
const language = vi.hoisted(() => ({ listener: undefined as (() => void) | undefined, off: vi.fn() }));
vi.mock('@/content/i18n/index.js', () => ({ onLanguageChange: (listener: () => void) => { language.listener = listener; return language.off; } }));

function fixture() {
  const values: Record<string, unknown> = { custom_enabled: true };
  let listener: (key: string, value: unknown) => void = () => {};
  const off = vi.fn();
  const ctx = {
    getSetting: vi.fn(async (key: string) => values[key]),
    onStorageChange: vi.fn(callback => { listener = callback; return off; }),
  } as unknown as FeatureContext;
  const handle = { mount: vi.fn(), reattach: vi.fn(), show: vi.fn(), hide: vi.fn(), destroy: vi.fn() } as unknown as FloatingWidgetHandle;
  const cleanup = vi.fn(), onMount = vi.fn(() => cleanup), onUnmount = vi.fn(), onLanguageChange = vi.fn();
  const create = vi.fn(() => handle);
  const feature = createWidgetFeature(ctx, { id: 'custom', featureKey: 'custom_enabled', create, onMount, onUnmount, onLanguageChange });
  return { feature, handle, values, create, cleanup, off, onLanguageChange, change: (key: string, value: unknown) => { values[key] = value; listener(key, value); } };
}
const flush = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
beforeEach(() => { vi.clearAllMocks(); });
describe('widget feature lifecycle', () => {
  it('creates once, reattaches on navigation, refreshes language and cleans up subscriptions', async () => {
    const f = fixture();
    await f.feature.enable(); await f.feature.enable(); await flush();
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.handle.reattach).toHaveBeenCalledTimes(1);
    language.listener?.(); expect(f.onLanguageChange).toHaveBeenCalledTimes(1);
    await f.feature.disable();
    expect(f.handle.destroy).toHaveBeenCalledTimes(1);
    expect(f.cleanup).toHaveBeenCalledTimes(1); expect(f.off).toHaveBeenCalledTimes(1);
    expect(language.off).toHaveBeenCalledTimes(1);
  });
  it('syncs custom widget visibility and ignores hydration after disable', async () => {
    const f = fixture(); await f.feature.enable(); await flush();
    expect(f.handle.show).toHaveBeenCalled();
    f.change('widget:custom', { visible: false }); await flush();
    expect(f.handle.hide).toHaveBeenCalledTimes(1);
    f.change('widget:custom', { visible: true }); await f.feature.disable(); await flush();
    expect(f.handle.show).toHaveBeenCalledTimes(1);
  });
  it('cancels pending DOM-ready mount on disable', async () => {
    const body = document.body; body.remove();
    const f = fixture();
    try {
      await f.feature.enable(); await f.feature.disable();
      document.documentElement.append(body); document.dispatchEvent(new Event('DOMContentLoaded'));
      expect(f.create).not.toHaveBeenCalled();
    } finally { if (!body.isConnected) document.documentElement.append(body); }
  });
});
