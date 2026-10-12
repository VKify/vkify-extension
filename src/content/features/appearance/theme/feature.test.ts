// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { createThemeFeatures } from './feature.js';
import { applyThemeState } from './state.js';
import { reconcileThemeFromSettings } from './mirror.js';

const root = document.documentElement;
function fixture() {
  const settings: Record<string, unknown> = { custom_theme: '#172a3d', custom_accent: '#ef1234', block_opacity: 0.5, glass_blur: 20 };
  const getSetting = vi.fn(async key => settings[key]);
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const features = createThemeFeatures({ getSetting } as unknown as FeatureContext);
  return { settings, getSetting, features, flush: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)); } };
}
afterEach(() => { applyThemeState({}); localStorage.clear(); vi.unstubAllGlobals(); });

describe('theme handlers and live preview', () => {
  it('shares one settings read for concurrent theme, accent and opacity updates', async () => {
    const { features, getSetting } = fixture();
    await Promise.all([features.custom_theme.enable?.('#172a3d'), features.custom_accent.enable?.('#ef1234'), features.block_opacity.enable?.(0.5)]);
    expect(getSetting).toHaveBeenCalledTimes(4);
    expect(root.hasAttribute('data-vkify-glass')).toBe(true);
    expect(features.custom_accent.reapplyOnNavigate).toBeUndefined();
  });
  it('preserves zero opacity through the feature manager disable path', async () => {
    const { features, settings } = fixture();
    await features.custom_theme.enable?.(settings.custom_theme);
    settings.block_opacity = 0;
    await features.block_opacity.disable?.();
    expect(root.style.getPropertyValue('--vkify-block-opacity')).toBe('0');
    expect(root.hasAttribute('data-vkify-glass')).toBe(true);
  });
  it('keeps the saved accent when the background theme is disabled', async () => {
    const { features, settings } = fixture();
    await features.custom_theme.enable?.(settings.custom_theme);
    settings.custom_theme = '';
    await features.custom_theme.disable?.();
    expect(root.hasAttribute('data-vkify-theme')).toBe(false);
    expect(root.hasAttribute('data-vkify-accent')).toBe(true);
    expect(root.style.getPropertyValue('--vkify-n15')).toBe('');
  });
  it('coalesces background and accent previews without storage reads', async () => {
    const { features, settings, getSetting, flush } = fixture();
    await features.custom_theme.enable?.(settings.custom_theme);
    getSetting.mockClear();
    features.custom_theme_preview.enable?.('#ffffff'); features.custom_accent_preview.enable?.('#123456'); flush();
    const expected = root.style.getPropertyValue('--vkify-accent');
    expect(expected).toContain('210');
    expect(root.hasAttribute('data-vkify-glass')).toBe(true);
    expect(getSetting).not.toHaveBeenCalled();
  });
  it('cancels queued previews when stored settings reset the theme', async () => {
    const { features, settings, flush } = fixture();
    await features.custom_theme.enable?.(settings.custom_theme);
    features.custom_theme_preview.enable?.('#ffffff');
    settings.custom_theme = ''; await features.custom_theme.disable?.(); flush();
    expect(root.hasAttribute('data-vkify-theme')).toBe(false);
  });
  it('does not resurrect an inactive theme when its preview races authoritative reconcile', () => {
    const { features, flush } = fixture();
    features.custom_theme_preview.enable?.('#ffffff');
    reconcileThemeFromSettings({}); flush();
    expect(root.hasAttribute('data-vkify-theme')).toBe(false);
  });
  it('ignores old async reads after a newer theme disable', async () => {
    const { features, getSetting, settings } = fixture();
    let resolve!: (value: unknown) => void;
    getSetting.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const pending = features.custom_theme.enable?.('#172a3d');
    await Promise.resolve();
    settings.custom_theme = ''; await features.custom_theme.disable?.();
    resolve('#172a3d'); await pending;
    expect(root.hasAttribute('data-vkify-theme')).toBe(false);
  });
  it('ignores a stale radius reset after a newer radius change', async () => {
    const { features, getSetting } = fixture();
    let resolve!: (value: unknown) => void;
    getSetting.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const pending = features.theme_radius.disable?.();
    features.theme_radius.enable?.(24); resolve(0); await pending;
    expect(root.style.getPropertyValue('--vkify-block-radius')).toBe('24px');
  });
});
