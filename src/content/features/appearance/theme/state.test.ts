// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyThemeState } from './state.js';
import { generateThemePalette, generateAccentPalette } from './palette.js';
import { themePaletteToVars, accentPaletteToVars } from './vars.js';
import { applyThemeFromMirror, reconcileThemeFromSettings, reconcileThemeEarlyFromStorage } from './mirror.js';

const root = document.documentElement;
const settings = { custom_theme: '#172a3d', custom_accent: '#ef1234', block_opacity: 0.5, glass_blur: 20, theme_radius: 24, block_depth: true };
afterEach(() => { applyThemeState({}); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('shared theme state', () => {
  it('preserves the existing palette for dark, light and saturated themes', () => {
    for (const bg of ['#172a3d', '#ffffff', '#bf2677']) {
      applyThemeState({ ...settings, custom_theme: bg });
      const expected = themePaletteToVars(generateThemePalette(bg, settings.custom_accent, 0.5));
      for (const [name, value] of Object.entries(expected)) expect(root.style.getPropertyValue(name)).toBe(value);
    }
  });
  it('makes unchanged settings a DOM and mirror-write no-op', () => {
    reconcileThemeFromSettings(settings);
    const write = vi.spyOn(localStorage, 'setItem');
    const observer = new MutationObserver(() => {});
    observer.observe(root, { attributes: true, subtree: true, childList: true });
    reconcileThemeFromSettings(settings);
    expect(write).not.toHaveBeenCalled();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
  it('keeps the independent accent and clears theme and glass variables on theme reset', () => {
    applyThemeState(settings);
    applyThemeState({ custom_accent: settings.custom_accent });
    expect(root.hasAttribute('data-vkify-theme')).toBe(false);
    expect(root.hasAttribute('data-vkify-accent')).toBe(true);
    expect(root.hasAttribute('data-vkify-glass')).toBe(false);
    for (const name of ['--vkify-n15', '--vkify-glass-amount', '--vkify-block-radius']) expect(root.style.getPropertyValue(name)).toBe('');
    for (const [name, value] of Object.entries(accentPaletteToVars(generateAccentPalette(settings.custom_accent)))) expect(root.style.getPropertyValue(name)).toBe(value);
  });
  it('keeps zero opacity and supplies only the glass input for CSS', () => {
    applyThemeState({ ...settings, block_opacity: 0 });
    expect(root.style.getPropertyValue('--vkify-block-opacity')).toBe('0');
    expect(root.style.getPropertyValue('--vkify-glass-amount')).toBe('20');
    expect(root.style.getPropertyValue('--vkify-glass-blur')).toBe('');
    expect(root.style.getPropertyValue('--vkify-glass-saturate')).toBe('');
  });
  it('ignores invalid colors and normalizes nonfinite inputs', () => {
    applyThemeState({ ...settings, custom_theme: 'dark', custom_accent: 'url(bad)', block_opacity: NaN, glass_blur: Infinity });
    expect(root.hasAttribute('data-vkify-theme')).toBe(false);
    expect(root.hasAttribute('data-vkify-accent')).toBe(false);
    expect(root.hasAttribute('data-vkify-glass')).toBe(false);
    applyThemeState({ ...settings, block_opacity: NaN });
    expect(root.style.getPropertyValue('--vkify-block-opacity')).toBe('1');
    expect(root.hasAttribute('data-vkify-glass')).toBe(false);
  });
  it('applies the mirror without waiting for page content', () => {
    localStorage.setItem('vkify:theme', JSON.stringify(settings));
    applyThemeFromMirror();
    expect(root.hasAttribute('data-vkify-theme')).toBe(true);
    expect(root.style.getPropertyValue('--vkify-glass-amount')).toBe('20');
  });
  it('does not apply a delayed startup snapshot after newer authoritative settings', async () => {
    let resolve!: (settings: Record<string, unknown>) => void;
    vi.stubGlobal('chrome', { storage: { local: { get: () => new Promise(r => { resolve = r; }) } } });
    reconcileThemeEarlyFromStorage();
    reconcileThemeFromSettings({ custom_accent: '#123456' });
    resolve(settings); await Promise.resolve();
    expect(root.hasAttribute('data-vkify-theme')).toBe(false);
    expect(JSON.parse(localStorage.getItem('vkify:theme')!)).toEqual({ custom_accent: '#123456' });
  });
});
