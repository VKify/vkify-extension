/** Цветовая математика темы: HSL-вывод палитры из фон/акцент-цветов. */

import type { ThemePalette, AccentPalette } from '@/types/index.js';

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, sat = 0;
  const lig = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    sat = lig > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: hue = ((b - r) / d + 2) / 6; break;
      case b: hue = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(hue * 360), s: Math.round(sat * 100), l: Math.round(lig * 100) };
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function hexToRgbString(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function generateThemePalette(bgHex: string, accentHex: string, blockOpacity = 1): ThemePalette {
  const hsl = hexToHsl(bgHex);
  const h = hsl.h;
  const baseSat = hsl.s;
  const baseL = hsl.l;

  const isDark = baseL < 50;
  const dir = isDark ? 1 : -1;
  const uiSat = baseSat;

  const bo = typeof blockOpacity === 'number' ? clamp(blockOpacity, 0, 1) : 1;
  const hasTransparency = bo < 1;

  const solid = (l: number, s = uiSat) => `hsl(${h}, ${s}%, ${clamp(l, 0, 100)}%)`;
  const bg = (l: number, s = uiSat) => hasTransparency
    ? `hsla(${h}, ${s}%, ${clamp(l, 0, 100)}%, ${bo})`
    : solid(l, s);
  const alpha = (l: number, a: number, s = uiSat) => `hsla(${h}, ${s}%, ${clamp(l, 0, 100)}%, ${a})`;

  const accentHsl = hexToHsl(accentHex);
  const ah = accentHsl.h;
  const as = accentHsl.s;
  const al = accentHsl.l;

  const accent = (lOffset = 0, sOffset = 0) =>
    `hsl(${ah}, ${clamp(as + sOffset, 0, 100)}%, ${clamp(al + lOffset, 0, 100)}%)`;
  const accentAlpha = (a: number, lOffset = 0) =>
    `hsla(${ah}, ${as}%, ${clamp(al + lOffset, 0, 100)}%, ${a})`;

  const lvlBg = baseL;
  const lvl1 = clamp(baseL + dir * 5, 0, 100);
  const lvl2 = clamp(baseL + dir * 10, 0, 100);
  const lvl3 = clamp(baseL + dir * 15, 0, 100);
  const lvl4 = clamp(baseL + dir * 25, 0, 100);
  const lvl5 = clamp(baseL + dir * 35, 0, 100);
  const lvl6 = clamp(baseL + dir * 45, 0, 100);
  const lvl7 = clamp(baseL + dir * 55, 0, 100);
  const lvlContrast = isDark ? 94 : 6;
  const lvlContrastSoft = isDark ? 88 : 12;
  const lvlInverse = isDark ? 8 : 92;

  // n00 — фон страницы для режима "глубины": на 5 единиц контрастнее базы в
  // ту же сторону, что и фон страницы (темнее блоков в тёмной теме).
  // Используется только когда включён data-vkify-depth (тогл "Глубина блоков").
  const lvl00 = clamp(baseL - dir * 6, 0, 100);

  return {
    n00: bg(lvl00),
    n00Solid: solid(lvl00),
    n15: bg(lvlBg),
    n22: bg(lvl1),
    n29: bg(lvl2),
    n33: bg(lvl3),
    n15Solid: solid(lvlBg),
    n22Solid: solid(lvl1),
    n29Solid: solid(lvl2),
    n44: solid(lvl4),
    n77: solid(lvl5),
    n99: solid(lvl6),
    ccc: solid(lvl7),
    eee: solid(lvlContrastSoft),
    black: solid(lvlContrast),
    white: solid(lvlInverse),
    n22Alpha: alpha(lvl1, 0.85),
    n29Alpha: alpha(lvl2, 0.5),
    n33Alpha: alpha(lvl3, 0.3),
    blackAlpha8: alpha(lvlContrast, 0.08),
    blackAlpha12: alpha(lvlContrast, 0.12),
    blackAlpha24: alpha(lvlContrast, 0.24),
    blackAlpha36: alpha(lvlContrast, 0.36),
    blackAlpha48: alpha(lvlContrast, 0.48),
    blackAlpha56: alpha(lvlContrast, 0.56),
    blackAlpha72: alpha(lvlContrast, 0.72),
    whiteAlpha72: alpha(lvlInverse, 0.72),
    iconSecondaryAlpha: alpha(lvlContrastSoft, 0.36),
    iconMediumAlpha: alpha(lvlContrastSoft, 0.48),
    contrast: solid(lvlContrast),
    accent: accent(),
    accentHover: accent(isDark ? 10 : -10),
    accentRgb: hexToRgbString(accentHex),
    g1: accent(isDark ? 10 : -10),
    g2: accent(),
    g3: accent(isDark ? -8 : 8),
    g4: accent(isDark ? -15 : 15),
    accentAlpha12: accentAlpha(0.12),
    accentAlpha16: accentAlpha(0.16),
    accentAlpha20: accentAlpha(0.20),
    accentAlpha24: accentAlpha(0.24),
    accentAlpha30: accentAlpha(0.30),
    k2: bg(lvl2),
    k2t: solid(lvl7),
    red: 'hsl(0, 70%, 50%)',
    redAlpha12: 'hsla(0, 70%, 50%, 0.12)',
    redAlpha16: 'hsla(0, 70%, 50%, 0.16)',
    redAlpha20: 'hsla(0, 70%, 50%, 0.20)',
    redAlpha30: 'hsla(0, 70%, 50%, 0.30)',
    likeColor: 'hsl(0, 75%, 55%)',
    green: 'hsl(135, 60%, 42%)',
    greenAlpha20: 'hsla(135, 60%, 42%, 0.20)',
    greenAlpha30: 'hsla(135, 60%, 42%, 0.30)',
    greenLight: 'hsla(135, 60%, 42%, 0.15)',
    yellowLight: 'hsla(45, 100%, 50%, 0.20)',
    warningAlpha20: 'hsla(42, 80%, 45%, 0.20)',
    gold200: 'hsla(40, 60%, 45%, 0.15)',
    gold250: 'hsla(42, 80%, 45%, 0.20)',
    gold400: 'hsl(40, 50%, 55%)',
    gold500: 'hsl(40, 55%, 45%)',
    lavender100: bg(clamp(baseL + dir * 7, 0, 100), clamp(baseSat + 10, 0, 100)),
    lavender200: bg(clamp(baseL + dir * 11, 0, 100), clamp(baseSat + 10, 0, 100)),
    lavender300: bg(clamp(baseL + dir * 15, 0, 100), clamp(baseSat + 10, 0, 100)),
    orange: 'hsl(30, 90%, 50%)',
    purple: 'hsl(280, 60%, 55%)',
    violet: 'hsl(260, 60%, 55%)',
    raspberryPink: 'hsl(340, 70%, 55%)',
    neonPink: 'hsl(320, 90%, 55%)',
    pinkLight: 'hsla(0, 70%, 50%, 0.10)',
    blockOpacity: bo,
  };
}

export function generateAccentPalette(accentHex: string): AccentPalette {
  const hsl = hexToHsl(accentHex);
  const h = hsl.h;
  const s = hsl.s;
  const l = hsl.l;

  const accent = (lOffset = 0) => `hsl(${h}, ${s}%, ${clamp(l + lOffset, 0, 100)}%)`;
  const accentAlpha = (a: number) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

  return {
    accent: accent(),
    accentHover: accent(10),
    accentAlpha12: accentAlpha(0.12),
    accentAlpha24: accentAlpha(0.24),
    accentAlpha30: accentAlpha(0.30),
  };
}
