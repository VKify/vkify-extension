// Instant (FOUC-free) application of the custom theme, mirroring the approach
// the popup already uses (bootstrapPopupThemeFromCache in popup/utils/themePalette.ts).
//
// Unlike the pure-static CSS features (see core/css-marker-mirror.ts), the theme
// needs more than a marker: theme.css is gated by `[data-vkify-theme]` AND reads
// ~80 `--vkify-*` custom properties computed from the user's bg/accent hex,
// block opacity, blur and radius. So we mirror those few inputs to localStorage
// and, synchronously at document_start, recompute the palette with the same pure
// functions the feature handlers use (theme.ts) and stamp both the vars and the
// markers on <html> before first paint. The authoritative reconcile against
// chrome.storage happens later in app.init (reconcileThemeFromSettings).
//
// Logo recolouring is intentionally skipped here — the logo SVG isn't in the DOM
// at document_start; the real custom_theme handler recolours it at init.

import {
  generateThemePalette,
  generateAccentPalette,
  themePaletteToVars,
  accentPaletteToVars,
  THEME_VAR_NAMES,
  clamp,
} from './index.js';
import { shouldEnable } from '@/content/core/should-enable.js';

const MIRROR_KEY = 'vkify:theme';

/** Storage keys whose values fully determine the synchronously-applied theme. */
export const THEME_MIRROR_KEYS = [
  'custom_theme',
  'custom_accent',
  'block_opacity',
  'glass_blur',
  'theme_radius',
  'block_depth',
] as const;

interface ThemeInputs {
  custom_theme?: unknown;
  custom_accent?: unknown;
  block_opacity?: unknown;
  glass_blur?: unknown;
  theme_radius?: unknown;
  block_depth?: unknown;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

/**
 * Deterministically set-or-clear every theme var/marker on `root` from the given
 * settings. Idempotent: re-running with the same inputs is a no-op, and running
 * with the theme disabled clears whatever a stale mirror may have applied.
 */
export function applyThemeState(s: ThemeInputs, root: HTMLElement = document.documentElement): void {
  const bg = s.custom_theme;
  const accentRaw = s.custom_accent;
  const opacity = num(s.block_opacity, 1);

  if (shouldEnable(bg)) {
    const accent = shouldEnable(accentRaw) ? (accentRaw as string) : '#0077ff';
    const palette = generateThemePalette(bg as string, accent, opacity);
    for (const [k, v] of Object.entries(themePaletteToVars(palette))) root.style.setProperty(k, v);
    root.setAttribute('data-vkify-theme', 'true');
    root.setAttribute('data-vkify-accent', 'true');
  } else if (shouldEnable(accentRaw)) {
    // Accent only, no full theme: clear theme vars, keep the 5 accent vars.
    for (const v of THEME_VAR_NAMES) root.style.removeProperty(v);
    for (const [k, v] of Object.entries(accentPaletteToVars(generateAccentPalette(accentRaw as string)))) {
      root.style.setProperty(k, v);
    }
    root.removeAttribute('data-vkify-theme');
    root.setAttribute('data-vkify-accent', 'true');
  } else {
    for (const v of THEME_VAR_NAMES) root.style.removeProperty(v);
    root.removeAttribute('data-vkify-theme');
    root.removeAttribute('data-vkify-accent');
  }

  // Glass (frosted blocks) — only meaningful atop a translucent custom theme.
  const blur = num(s.glass_blur, 0);
  if (shouldEnable(bg) && opacity < 1 && blur > 0) {
    root.setAttribute('data-vkify-glass', 'true');
    root.style.setProperty('--vkify-glass-blur', `${blur}px`);
    root.style.setProperty('--vkify-glass-saturate', `${clamp(100 + blur * 3, 100, 220)}%`);
  } else {
    root.removeAttribute('data-vkify-glass');
    root.style.removeProperty('--vkify-glass-blur');
    root.style.removeProperty('--vkify-glass-saturate');
  }

  // Block radius.
  const radius = num(s.theme_radius, 0);
  if (radius > 0) {
    root.style.setProperty('--vkify-block-radius', `${radius}px`);
    root.style.setProperty('--vkify-block-radius-half', `${Math.round(radius / 2)}px`);
    root.setAttribute('data-vkify-theme-radius', 'true');
  } else {
    root.style.removeProperty('--vkify-block-radius');
    root.style.removeProperty('--vkify-block-radius-half');
    root.removeAttribute('data-vkify-theme-radius');
  }

  // Block depth.
  if (shouldEnable(s.block_depth)) root.setAttribute('data-vkify-depth', 'true');
  else root.removeAttribute('data-vkify-depth');
}

function pickInputs(settings: Record<string, unknown>): ThemeInputs {
  const out: ThemeInputs = {};
  for (const key of THEME_MIRROR_KEYS) out[key] = settings[key];
  return out;
}

function writeMirror(settings: Record<string, unknown>): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(pickInputs(settings)));
  } catch {
    // quota / disabled storage — non-fatal
  }
}

/** Synchronously apply the cached theme at document_start, before first paint. */
export function applyThemeFromMirror(): void {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return;
    const inputs = JSON.parse(raw) as ThemeInputs;
    if (inputs && typeof inputs === 'object') applyThemeState(inputs);
  } catch {
    // corrupt mirror — reconcile against real storage will heal it
  }
}

/**
 * After app.init() has the authoritative settings, re-apply the theme
 * deterministically (clearing anything a stale mirror set) and refresh the
 * cache for the next load.
 */
export function reconcileThemeFromSettings(settings: Record<string, unknown>): void {
  applyThemeState(pickInputs(settings));
  writeMirror(settings);
}

/**
 * Ранний (document_start) авторитетный reconcile из chrome.storage — не ждёт
 * DOMContentLoaded/app.init().
 *
 * Зеркало в localStorage — per-origin: смену темы из попапа подхватывают только
 * открытые вкладки. У vkvideo.ru вкладка обычно закрыта, поэтому его зеркало
 * пустое/устаревшее, и до этого фикса реальная тема приезжала только после
 * полного init() — с видимой задержкой (на vk.com вкладка почти всегда открыта,
 * там зеркало свежее). chrome.storage доступен content-скрипту сразу; читаем
 * только THEME_MIRROR_KEYS (без полного дампа) и применяем через несколько мс —
 * задолго до того, как страница отрисует контент. Заодно освежаем зеркало
 * этого origin. Поверх позже пройдёт штатный reconcile в app.init (идемпотентно).
 */
export function reconcileThemeEarlyFromStorage(): void {
  try {
    void chrome.storage.local.get([...THEME_MIRROR_KEYS]).then((settings) => {
      applyThemeState(pickInputs(settings));
      writeMirror(settings);
    }).catch(() => { /* контекст умер — reconcile в init подстрахует */ });
  } catch {
    // chrome.* недоступен (orphaned script) — не мешаем странице
  }
}
