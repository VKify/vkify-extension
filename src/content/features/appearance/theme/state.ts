import { generateThemePalette, generateAccentPalette, clamp } from './palette.js';
import { themePaletteToVars, accentPaletteToVars, THEME_VAR_NAMES } from './vars.js';
import { applyBlockRadius } from './radius.js';
import { setThemeProperty, setThemeMarker } from './dom-state.js';

export interface ThemeInputs {
  custom_theme?: unknown;
  custom_accent?: unknown;
  block_opacity?: unknown;
  glass_blur?: unknown;
  theme_radius?: unknown;
  block_depth?: unknown;
}

const palettes = new WeakMap<HTMLElement, { key: string; vars: Record<string, string> }>();
function color(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}
function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

/** Shared by startup, persisted settings, and previews; page elements use CSS only. */
export function applyThemeColorState(inputs: ThemeInputs, root: HTMLElement = document.documentElement): void {
  const bg = color(inputs.custom_theme);
  const accent = color(inputs.custom_accent);
  const opacity = number(inputs.block_opacity, 1, 0, 1);
  const key = JSON.stringify([bg, accent, bg ? opacity : 1]);
  let palette = palettes.get(root);
  if (palette?.key !== key) {
    palette = { key, vars: bg ? themePaletteToVars(generateThemePalette(bg, accent ?? '#0077ff', opacity))
      : accent ? accentPaletteToVars(generateAccentPalette(accent)) : {} };
    palettes.set(root, palette);
  }
  for (const name of THEME_VAR_NAMES) setThemeProperty(root, name, palette.vars[name]);
  setThemeMarker(root, 'data-vkify-theme', !!bg);
  setThemeMarker(root, 'data-vkify-accent', !!bg || !!accent);

  const blur = number(inputs.glass_blur, 0, 0, 100);
  const glass = !!bg && opacity < 1 && blur > 0;
  setThemeMarker(root, 'data-vkify-glass', glass);
  // CSS derives pixel blur and saturation from this one numeric input.
  setThemeProperty(root, '--vkify-glass-amount', glass ? String(blur) : undefined);
}

export function applyThemeState(inputs: ThemeInputs, root: HTMLElement = document.documentElement): void {
  applyThemeColorState(inputs, root);
  applyBlockRadius(inputs.theme_radius, root);
  setThemeMarker(root, 'data-vkify-depth', inputs.block_depth === true);
}
