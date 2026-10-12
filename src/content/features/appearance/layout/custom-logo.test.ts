// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { createCustomLogoHandler } from './custom-logo.js';
import { isValidSettingValue } from '@/shared/constants/settings-schema.js';
import { buildApplyPatch, captureAppearance } from '@/popup/utils/appearanceProfile.js';

const markup = '<a data-testid="top-logo-link" href="/feed" aria-label="На главную" accesskey="1"><svg class="Logo__icon--eLIzO" width="136" height="24"><path fill="#07f" /></svg></a>';
function fixture() {
  const settings: Record<string, unknown> = { custom_logo: 'https://example.com/logo.png' };
  let changed = (): void => {};
  const off = vi.fn();
  const ctx = {
    getSetting: vi.fn(async key => settings[key]), injectCSS: vi.fn(), removeCSS: vi.fn(),
    observeChanges: vi.fn((_id, callback) => { changed = callback; return off; }),
  } as unknown as FeatureContext;
  document.body.innerHTML = markup;
  return { handler: createCustomLogoHandler(ctx), ctx, off, set: (next: unknown) => { settings.custom_logo = next; },
    color: (mode: unknown, color: unknown = '#ff1234') => { settings.custom_logo_color_mode = mode; settings.custom_logo_color = color; }, change: () => changed() };
}
afterEach(() => { document.body.innerHTML = ''; });

describe('custom header logo', () => {
  it('changes tint without reloading the image and restores original colors', async () => {
    const { handler, color } = fixture();
    await handler.enable();
    const image = document.querySelector('img')!;
    const container = image.parentElement!;
    color('custom'); await handler.enable();
    expect(document.querySelector('img')).toBe(image);
    expect(container.dataset.colorMode).toBe('custom');
    expect(container.style.getPropertyValue('--vkify-logo-color')).toBe('#ff1234');
    color('theme'); await handler.enable();
    expect(container.style.getPropertyValue('--vkify-logo-color')).toContain('--vkify-accent');
    color('text'); await handler.enable();
    expect(container.dataset.colorMode).toBe('original');
    color('invalid', 'url(bad)'); await handler.enable();
    expect(container.dataset.colorMode).toBe('original');
    expect(container.style.getPropertyValue('--vkify-logo-color')).toBe('#0077ff');
    handler.disable();
    expect(document.querySelector('.vkify-custom-logo')).toBeNull();
  });
  it('preserves the native link and SVG, only hiding the SVG after the image loads', async () => {
    const { handler, ctx, off } = fixture();
    const original = document.querySelector('svg');
    await handler.enable(); await handler.enable();
    const link = document.querySelector('a')!;
    expect(link.hasAttribute('data-vkify-custom-logo')).toBe(false);
    expect(link.querySelectorAll('img')).toHaveLength(1);
    expect(ctx.observeChanges).toHaveBeenCalledOnce();
    link.querySelector('img')!.dispatchEvent(new Event('load'));
    expect(link.getAttribute('data-vkify-custom-logo')).toBe('true');
    expect(link.getAttribute('href')).toBe('/feed');
    expect(link.getAttribute('aria-label')).toBe('На главную');
    handler.disable();
    expect(document.querySelector('svg')).toBe(original);
    expect(link.querySelector('img')).toBeNull();
    expect(link.hasAttribute('data-vkify-custom-logo')).toBe(false);
    expect(off).toHaveBeenCalledOnce();
  });
  it('replaces the image after a setting change and repairs React header replacements', async () => {
    const { handler, set, change } = fixture();
    await handler.enable();
    const old = document.querySelector('img')!;
    set('https://example.com/new.png'); await handler.enable();
    expect(old.isConnected).toBe(false);
    expect(document.querySelector('img')!.src).toBe('https://example.com/new.png');
    document.body.innerHTML = markup; change();
    expect(document.querySelectorAll('img')).toHaveLength(1);
    document.querySelector('img')!.remove(); change();
    expect(document.querySelectorAll('img')).toHaveLength(1);
    handler.disable(); change();
    expect(document.querySelector('img')).toBeNull();
  });
  it('leaves the VK logo available after an image error or unsafe storage value', async () => {
    const { handler, set } = fixture();
    await handler.enable();
    const image = document.querySelector('img')!;
    image.dispatchEvent(new Event('load')); image.dispatchEvent(new Event('error'));
    expect(document.querySelector('a')!.hasAttribute('data-vkify-custom-logo')).toBe(false);
    set('javascript:alert(1)'); await handler.enable();
    expect(document.querySelector('img')).toBeNull();
    handler.disable();
  });
  it('does not resurrect a disabled logo while a setting read is pending', async () => {
    const { handler, ctx } = fixture();
    let resolve!: (value: string) => void;
    vi.mocked(ctx.getSetting).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const pending = handler.enable(); handler.disable(); resolve('https://example.com/logo.png');
    await pending; expect(document.querySelector('img')).toBeNull();
    expect(ctx.observeChanges).not.toHaveBeenCalled();
  });
  it('validates image resources and round-trips the logo in appearance profiles', () => {
    const data = 'data:image/png;base64,aGVsbG8=';
    for (const value of ['', data, 'https://example.com/logo.svg']) expect(isValidSettingValue('custom_logo', value, 'theme')).toBe(true);
    for (const value of ['javascript:alert(1)', 'data:text/html;base64,aGVsbG8=', 'blob:local', 'https://user:password@example.com/logo.png']) expect(isValidSettingValue('custom_logo', value, 'import')).toBe(false);
    expect(isValidSettingValue('custom_logo_color', 'url(bad)', 'theme')).toBe(false);
    expect(isValidSettingValue('custom_logo_color_mode', 'bad', 'theme')).toBe(false);
    expect(isValidSettingValue('custom_logo_color_mode', 'text', 'theme')).toBe(false);
    const snapshot = captureAppearance({ custom_logo_enabled: true, custom_logo: data, custom_logo_color_mode: 'custom', custom_logo_color: '#ff1234' });
    expect(buildApplyPatch(snapshot)).toMatchObject(snapshot);
    expect(buildApplyPatch({})).toMatchObject({ custom_logo_enabled: false, custom_logo: '' });
  });
});
