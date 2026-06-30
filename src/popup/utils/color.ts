/**
 * Конвертеры и нормализация цветов — единая реализация для попапа.
 *
 * Раньше hex↔HSL/RGB жили приватно в themePalette.ts; вынесены сюда, чтобы их
 * мог переиспользовать кастомный color picker (ColorPickerPanel) без дублей.
 * Поведение hexToHsl/hslToHex/normalizeHex идентично прежнему (см.
 * themePalette.test.ts → deriveAccentFromBg).
 *
 * Диапазоны: H ∈ [0,360), S/L/V ∈ [0,100], R/G/B ∈ [0,255].
 */

export interface Rgb { r: number; g: number; b: number }
export interface Hsl { h: number; s: number; l: number }
export interface Hsv { h: number; s: number; v: number }

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Нормализует строку в `#rrggbb` или возвращает null, если это не hex-цвет. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let v = value.trim().replace(/^#/, '');
  // Короткая запись #abc → #aabbcc.
  if (/^[0-9a-fA-F]{3}$/.test(v)) v = v.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return `#${v.toLowerCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const h = (normalizeHex(hex) ?? '#000000').slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function channel(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Каналы `r g b` из hex — для Tailwind-цвета `rgb(var(--primary-rgb) / <alpha>)`. */
export function hexToRgbChannels(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const lig = (max + min) / 2;
  let hue = 0;
  let sat = 0;

  if (max !== min) {
    const d = max - min;
    sat = lig > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rN: hue = (gN - bN) / d + (gN < bN ? 6 : 0); break;
      case gN: hue = (bN - rN) / d + 2; break;
      default: hue = (rN - gN) / d + 4; break;
    }
    hue /= 6;
  }

  return { h: Math.round(hue * 360), s: Math.round(sat * 100), l: Math.round(lig * 100) };
}

/** HSL → `#rrggbb`. h в [0,360), s/l в [0,100]. */
export function hslToHex(h: number, s: number, l: number): string {
  const sN = clamp(s, 0, 100) / 100;
  const lN = clamp(l, 0, 100) / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const c = lN - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const sN = clamp(s, 0, 100) / 100;
  const lN = clamp(l, 0, 100) / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (lN - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return { r: f(0), g: f(8), b: f(4) };
}

// --- HSV (для 2D saturation/value-области пикера) -------------------------

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rN: h = ((gN - bN) / d) % 6; break;
      case gN: h = (bN - rN) / d + 2; break;
      default: h = (rN - gN) / d + 4; break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : Math.round((d / max) * 100);
  const v = Math.round(max * 100);
  return { h, s, v };
}

export function hsvToRgb(h: number, s: number, v: number): Rgb {
  const sN = clamp(s, 0, 100) / 100;
  const vN = clamp(v, 0, 100) / 100;
  const c = vN * sN;
  const hh = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh >= 0 && hh < 1) { r = c; g = x; }
  else if (hh < 2) { r = x; g = c; }
  else if (hh < 3) { g = c; b = x; }
  else if (hh < 4) { g = x; b = c; }
  else if (hh < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = vN - c;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
}

export function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}
