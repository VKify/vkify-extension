import { isSafeLogoResource, parseLogoColorMode, logoTintColor } from '@/shared/custom-logo.js';
import css from './custom-logo-early.css?inline';

const MIRROR_KEY = 'vkify:custom-logo';
const STYLE_ID = 'vkify-custom-logo-early';
const PRELOAD_ID = 'vkify-custom-logo-preload';
export const LOGO_MIRROR_KEYS = ['custom_logo_enabled', 'custom_logo', 'custom_logo_color_mode', 'custom_logo_color'] as const;
let revision = 0;
let cachedSettings: unknown[] | undefined;

/** CSS can style a header that does not exist yet; no DOM observer or init delay. */
export function applyCustomLogoEarlyState(settings: Record<string, unknown>): void {
  const root = document.documentElement;
  const source = settings.custom_logo;
  if (settings.custom_logo_enabled !== true || !isSafeLogoResource(source) || !source) {
    root.removeAttribute('data-vkify-early-logo');
    root.style.removeProperty('--vkify-early-logo-image');
    root.style.removeProperty('--vkify-early-logo-color');
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(PRELOAD_ID)?.remove();
    return;
  }
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style'); style.id = STYLE_ID; style.textContent = css;
    root.append(style);
  }
  const mode = parseLogoColorMode(settings.custom_logo_color_mode);
  // Large data URLs should not be serialized or assigned again for color-only updates.
  let preload = document.getElementById(PRELOAD_ID) as HTMLLinkElement | null;
  if (preload?.getAttribute('href') !== source) root.style.setProperty('--vkify-early-logo-image', `url(${JSON.stringify(source)})`);
  const color = logoTintColor(mode, settings.custom_logo_color);
  if (root.style.getPropertyValue('--vkify-early-logo-color') !== color) root.style.setProperty('--vkify-early-logo-color', color);
  if (root.getAttribute('data-vkify-early-logo') !== mode) root.setAttribute('data-vkify-early-logo', mode);
  if (!preload) {
    preload = document.createElement('link'); preload.id = PRELOAD_ID;
    preload.rel = 'preload'; preload.as = 'image'; preload.referrerPolicy = 'no-referrer'; root.append(preload);
  }
  if (preload.getAttribute('href') !== source) preload.href = source;
}

export function reconcileCustomLogoFromSettings(settings: Record<string, unknown>): void {
  revision++;
  applyCustomLogoEarlyState(settings);
  const values = LOGO_MIRROR_KEYS.map(key => settings[key]);
  if (cachedSettings?.every((value, index) => value === values[index])) return;
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(Object.fromEntries(LOGO_MIRROR_KEYS.map(key => [key, settings[key]]))));
    cachedSettings = values;
  } catch {
    cachedSettings = undefined;
    // Never retain a stale logo when a larger new image exceeds the origin quota.
    try { localStorage.removeItem(MIRROR_KEY); } catch { /* storage disabled */ }
  }
}

export function applyCustomLogoFromMirror(): void {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return;
    const settings: unknown = JSON.parse(raw);
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) applyCustomLogoEarlyState(settings as Record<string, unknown>);
  } catch { /* authoritative early read repairs corrupt caches */ }
}

export function reconcileCustomLogoEarlyFromStorage(): void {
  const request = revision;
  try {
    void chrome.storage.local.get([...LOGO_MIRROR_KEYS]).then(settings => {
      if (revision === request) reconcileCustomLogoFromSettings(settings);
    }).catch(() => {});
  } catch { /* orphaned extension context */ }
}
