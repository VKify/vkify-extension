// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyCustomLogoEarlyState, applyCustomLogoFromMirror, reconcileCustomLogoFromSettings, reconcileCustomLogoEarlyFromStorage } from './custom-logo-early.js';

afterEach(() => {
  reconcileCustomLogoFromSettings({}); document.body.innerHTML = ''; localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('custom logo before feature initialization', () => {
  it('clears a stale cache from authoritative storage without waiting for app init', async () => {
    reconcileCustomLogoFromSettings({ custom_logo_enabled: true, custom_logo: 'https://example.com/old.svg' });
    const get = vi.fn(async () => ({ custom_logo_enabled: false }));
    vi.stubGlobal('chrome', { storage: { local: { get } } });
    reconcileCustomLogoEarlyFromStorage();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute('data-vkify-early-logo')).toBe(false);
    expect(JSON.parse(localStorage.getItem('vkify:custom-logo')!)).toEqual({ custom_logo_enabled: false });
    expect(get).toHaveBeenCalledOnce();
  });
  it('does not overwrite newer preferences with a delayed storage snapshot', async () => {
    let resolve!: (settings: Record<string, unknown>) => void;
    vi.stubGlobal('chrome', { storage: { local: { get: () => new Promise(r => { resolve = r; }) } } });
    reconcileCustomLogoEarlyFromStorage();
    reconcileCustomLogoFromSettings({ custom_logo_enabled: true, custom_logo: 'https://example.com/new.svg', custom_logo_color_mode: 'custom', custom_logo_color: '#123456' });
    resolve({ custom_logo_enabled: false });
    await Promise.resolve();
    expect(document.documentElement.getAttribute('data-vkify-early-logo')).toBe('custom');
    expect(document.documentElement.style.getPropertyValue('--vkify-early-logo-image')).toContain('/new.svg');
  });
  it('applies and caches presentation before the header exists', () => {
    const settings = { custom_logo_enabled: true, custom_logo: 'data:image/png;base64,aGVsbG8=', custom_logo_color_mode: 'theme' };
    reconcileCustomLogoFromSettings(settings);
    expect(document.querySelector('[data-testid="top-logo-link"]')).toBeNull();
    expect(document.documentElement.getAttribute('data-vkify-early-logo')).toBe('theme');
    expect(document.getElementById('vkify-custom-logo-early')).not.toBeNull();
    expect(document.getElementById('vkify-custom-logo-preload')?.getAttribute('href')).toBe(settings.custom_logo);
    applyCustomLogoEarlyState({});
    applyCustomLogoFromMirror();
    expect(document.documentElement.getAttribute('data-vkify-early-logo')).toBe('theme');
  });
  it('clears stale presentation when disabled or given unsafe resources', () => {
    const settings = { custom_logo_enabled: true, custom_logo: 'https://example.com/logo.svg' };
    for (const patch of [{ custom_logo_enabled: false }, { custom_logo: 'javascript:alert(1)' }, { custom_logo: '' }]) {
      applyCustomLogoEarlyState(settings);
      applyCustomLogoEarlyState({ ...settings, ...patch });
      expect(document.documentElement.hasAttribute('data-vkify-early-logo')).toBe(false);
      expect(document.documentElement.style.getPropertyValue('--vkify-early-logo-image')).toBe('');
      expect(document.getElementById('vkify-custom-logo-early')).toBeNull();
      expect(document.getElementById('vkify-custom-logo-preload')).toBeNull();
    }
  });
  it('does not duplicate styles or preloads on reconciliation', () => {
    const settings = { custom_logo_enabled: true, custom_logo: 'https://example.com/logo.svg', custom_logo_color_mode: 'custom', custom_logo_color: '#123456' };
    applyCustomLogoEarlyState(settings); applyCustomLogoEarlyState(settings);
    expect(document.querySelectorAll('#vkify-custom-logo-early')).toHaveLength(1);
    expect(document.querySelectorAll('#vkify-custom-logo-preload')).toHaveLength(1);
    expect(document.documentElement.style.getPropertyValue('--vkify-early-logo-color')).toBe('#123456');
  });
  it('does not rewrite the image cache or DOM for unchanged settings', () => {
    const settings = { custom_logo_enabled: true, custom_logo: 'https://example.com/logo.svg', custom_logo_color_mode: 'theme' };
    reconcileCustomLogoFromSettings(settings);
    const write = vi.spyOn(localStorage, 'setItem');
    const observer = new MutationObserver(() => {});
    observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
    reconcileCustomLogoFromSettings(settings);
    expect(write).not.toHaveBeenCalled();
    expect(observer.takeRecords()).toHaveLength(0);
    observer.disconnect();
  });
  it('ignores corrupt or unsafe page-owned caches', () => {
    for (const value of ['{', '[]', JSON.stringify({ custom_logo_enabled: true, custom_logo: 'javascript:alert(1)' })]) {
      localStorage.setItem('vkify:custom-logo', value); applyCustomLogoFromMirror();
      expect(document.documentElement.hasAttribute('data-vkify-early-logo')).toBe(false);
    }
  });
});
