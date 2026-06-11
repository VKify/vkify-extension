import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap, ThemePalette, AccentPalette } from '../../../types/index.js';

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

/** Карта CSS-переменных `--vkify-*`, потребляемых theme.css, из палитры темы. */
export function themePaletteToVars(palette: ThemePalette): Record<string, string> {
  return {
    '--vkify-n00': palette.n00,
    '--vkify-n00-solid': palette.n00Solid,
    '--vkify-n15': palette.n15,
    '--vkify-n15-solid': palette.n15Solid,
    '--vkify-n22': palette.n22,
    '--vkify-n22-solid': palette.n22Solid,
    '--vkify-n22-alpha': palette.n22Alpha,
    '--vkify-n29': palette.n29,
    '--vkify-n29-solid': palette.n29Solid,
    '--vkify-n29-alpha': palette.n29Alpha,
    '--vkify-n33': palette.n33,
    '--vkify-n33-alpha': palette.n33Alpha,
    '--vkify-n44': palette.n44,
    '--vkify-n77': palette.n77,
    '--vkify-n99': palette.n99,
    '--vkify-ccc': palette.ccc,
    '--vkify-eee': palette.eee,
    '--vkify-black': palette.black,
    '--vkify-white': palette.white,
    '--vkify-black-alpha8': palette.blackAlpha8,
    '--vkify-black-alpha12': palette.blackAlpha12,
    '--vkify-black-alpha24': palette.blackAlpha24,
    '--vkify-black-alpha36': palette.blackAlpha36,
    '--vkify-black-alpha48': palette.blackAlpha48,
    '--vkify-black-alpha56': palette.blackAlpha56,
    '--vkify-black-alpha72': palette.blackAlpha72,
    '--vkify-white-alpha72': palette.whiteAlpha72,
    '--vkify-icon-secondary-alpha': palette.iconSecondaryAlpha,
    '--vkify-icon-medium-alpha': palette.iconMediumAlpha,
    '--vkify-contrast': palette.contrast,
    '--vkify-accent': palette.accent,
    '--vkify-accent-hover': palette.accentHover,
    '--vkify-accent-rgb': palette.accentRgb,
    '--vkify-g1': palette.g1,
    '--vkify-g2': palette.g2,
    '--vkify-g3': palette.g3,
    '--vkify-g4': palette.g4,
    '--vkify-accent-alpha12': palette.accentAlpha12,
    '--vkify-accent-alpha16': palette.accentAlpha16,
    '--vkify-accent-alpha20': palette.accentAlpha20,
    '--vkify-accent-alpha24': palette.accentAlpha24,
    '--vkify-accent-alpha30': palette.accentAlpha30,
    '--vkify-k2': palette.k2,
    '--vkify-k2t': palette.k2t,
    '--vkify-red': palette.red,
    '--vkify-red-alpha12': palette.redAlpha12,
    '--vkify-red-alpha16': palette.redAlpha16,
    '--vkify-red-alpha20': palette.redAlpha20,
    '--vkify-red-alpha30': palette.redAlpha30,
    '--vkify-like-color': palette.likeColor,
    '--vkify-green': palette.green,
    '--vkify-green-alpha20': palette.greenAlpha20,
    '--vkify-green-alpha30': palette.greenAlpha30,
    '--vkify-green-light': palette.greenLight,
    '--vkify-yellow-light': palette.yellowLight,
    '--vkify-warning-alpha20': palette.warningAlpha20,
    '--vkify-gold-200': palette.gold200,
    '--vkify-gold-250': palette.gold250,
    '--vkify-gold-400': palette.gold400,
    '--vkify-gold-500': palette.gold500,
    '--vkify-lavender-100': palette.lavender100,
    '--vkify-lavender-200': palette.lavender200,
    '--vkify-lavender-300': palette.lavender300,
    '--vkify-orange': palette.orange,
    '--vkify-purple': palette.purple,
    '--vkify-violet': palette.violet,
    '--vkify-raspberry-pink': palette.raspberryPink,
    '--vkify-neon-pink': palette.neonPink,
    '--vkify-pink-light': palette.pinkLight,
    '--vkify-block-opacity': String(palette.blockOpacity),
  };
}

/** Подмножество акцентных переменных (когда выбран только акцент, без темы). */
export function accentPaletteToVars(palette: AccentPalette): Record<string, string> {
  return {
    '--vkify-accent': palette.accent,
    '--vkify-accent-hover': palette.accentHover,
    '--vkify-accent-alpha12': palette.accentAlpha12,
    '--vkify-accent-alpha24': palette.accentAlpha24,
    '--vkify-accent-alpha30': palette.accentAlpha30,
  };
}

/** Полный список переменных темы — для сброса (вкл. glass-переменные). */
export const THEME_VAR_NAMES: readonly string[] = [
  '--vkify-n00', '--vkify-n00-solid',
  '--vkify-n15', '--vkify-n15-solid',
  '--vkify-n22', '--vkify-n22-solid', '--vkify-n22-alpha',
  '--vkify-n29', '--vkify-n29-solid', '--vkify-n29-alpha',
  '--vkify-n33', '--vkify-n33-alpha',
  '--vkify-n44', '--vkify-n77', '--vkify-n99',
  '--vkify-ccc', '--vkify-eee', '--vkify-black', '--vkify-white',
  '--vkify-black-alpha8', '--vkify-black-alpha12', '--vkify-black-alpha24',
  '--vkify-black-alpha36', '--vkify-black-alpha48', '--vkify-black-alpha56',
  '--vkify-black-alpha72', '--vkify-white-alpha72',
  '--vkify-icon-secondary-alpha', '--vkify-icon-medium-alpha', '--vkify-contrast',
  '--vkify-accent', '--vkify-accent-hover', '--vkify-accent-rgb',
  '--vkify-g1', '--vkify-g2', '--vkify-g3', '--vkify-g4',
  '--vkify-accent-alpha12', '--vkify-accent-alpha16', '--vkify-accent-alpha20',
  '--vkify-accent-alpha24', '--vkify-accent-alpha30',
  '--vkify-k2', '--vkify-k2t',
  '--vkify-red', '--vkify-red-alpha12', '--vkify-red-alpha16',
  '--vkify-red-alpha20', '--vkify-red-alpha30',
  '--vkify-like-color',
  '--vkify-green', '--vkify-green-alpha20', '--vkify-green-alpha30', '--vkify-green-light',
  '--vkify-yellow-light', '--vkify-warning-alpha20',
  '--vkify-gold-200', '--vkify-gold-250', '--vkify-gold-400', '--vkify-gold-500',
  '--vkify-lavender-100', '--vkify-lavender-200', '--vkify-lavender-300',
  '--vkify-orange', '--vkify-purple', '--vkify-violet',
  '--vkify-raspberry-pink', '--vkify-neon-pink',
  '--vkify-pink-light', '--vkify-block-opacity',
  '--vkify-glass-blur', '--vkify-glass-saturate',
];

/** Акцентные переменные — для сброса при выключении только акцента. */
export const ACCENT_VAR_NAMES: readonly string[] = [
  '--vkify-accent', '--vkify-accent-hover',
  '--vkify-accent-alpha12', '--vkify-accent-alpha24', '--vkify-accent-alpha30',
];

export function createThemeFeatures(manager: FeatureManager): FeatureMap {
  let logoObserver: MutationObserver | null = null;

  function updateLogoColor(color: string) {
    const findAndMarkLogoPaths = () => {
      const logoContainers = document.querySelectorAll(
        '[class*="Logo__root"] svg, .TopHomeLink svg, a[class*="Logo"] svg',
      );

      logoContainers.forEach(svg => {
        svg.querySelectorAll('path').forEach(path => {
          const fill = path.getAttribute('fill');
          if (fill && (
            fill.toLowerCase() === '#07f' ||
            fill.toLowerCase() === '#0077ff' ||
            path.hasAttribute('data-vkify-logo-bg')
          )) {
            path.setAttribute('data-vkify-logo-bg', 'true');
            path.setAttribute('fill', color);
          }
        });
      });
    };

    findAndMarkLogoPaths();
    setTimeout(findAndMarkLogoPaths, 100);
    setTimeout(findAndMarkLogoPaths, 500);

    if (logoObserver) logoObserver.disconnect();

    logoObserver = new MutationObserver(findAndMarkLogoPaths);
    const header = document.querySelector('#page_header_wrap, header, #top_nav');
    if (header) {
      logoObserver.observe(header, { childList: true, subtree: true });
    }
  }

  function resetLogoColor() {
    if (logoObserver) {
      logoObserver.disconnect();
      logoObserver = null;
    }

    document.querySelectorAll('[data-vkify-logo-bg="true"]').forEach(path => {
      path.setAttribute('fill', '#07F');
      path.removeAttribute('data-vkify-logo-bg');
    });
  }

  function setThemeVariables(palette: ThemePalette) {
    const root = document.documentElement;
    const vars = themePaletteToVars(palette);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  function setAccentVariables(palette: AccentPalette) {
    const root = document.documentElement;
    const vars = accentPaletteToVars(palette);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  function removeThemeVariables() {
    const root = document.documentElement;
    THEME_VAR_NAMES.forEach(v => root.style.removeProperty(v));
  }

  function removeAccentVariables() {
    const root = document.documentElement;
    ACCENT_VAR_NAMES.forEach(v => root.style.removeProperty(v));
  }

  async function rebuildPalette(overrides: { bgColor?: string; accentColor?: string; blockOpacity?: number } = {}): Promise<ThemePalette | null> {
    const settings = await manager.getAllSettings();
    const bgColor = overrides.bgColor ?? settings.custom_theme as string | undefined;
    if (!bgColor) return null;

    const accentColor = overrides.accentColor ?? settings.custom_accent as string ?? '#0077ff';
    const blockOpacity = overrides.blockOpacity ?? (typeof settings.block_opacity === 'number' ? settings.block_opacity : 1);

    return generateThemePalette(bgColor, accentColor as string, blockOpacity as number);
  }

  async function updateGlassState() {
    const settings = await manager.getAllSettings();
    const opacity = typeof settings.block_opacity === 'number' ? settings.block_opacity : 1;
    const blur = typeof settings.glass_blur === 'number' ? settings.glass_blur : 0;

    if (settings.custom_theme && opacity < 1 && blur > 0) {
      document.documentElement.setAttribute('data-vkify-glass', 'true');
      document.documentElement.style.setProperty('--vkify-glass-blur', `${blur}px`);
      const saturate = clamp(100 + blur * 3, 100, 220);
      document.documentElement.style.setProperty('--vkify-glass-saturate', `${saturate}%`);
    } else {
      document.documentElement.removeAttribute('data-vkify-glass');
      document.documentElement.style.removeProperty('--vkify-glass-blur');
      document.documentElement.style.removeProperty('--vkify-glass-saturate');
    }
  }

  return {
    custom_theme: {
      enable: async (value?: unknown) => {
        if (!value) return;
        const palette = await rebuildPalette({ bgColor: value as string });
        if (!palette) return;
        setThemeVariables(palette);
        document.documentElement.setAttribute('data-vkify-theme', 'true');
        document.documentElement.setAttribute('data-vkify-accent', 'true');
        updateLogoColor(palette.accent);
        await updateGlassState();
      },
      disable: () => {
        document.documentElement.removeAttribute('data-vkify-theme');
        document.documentElement.removeAttribute('data-vkify-accent');
        document.documentElement.removeAttribute('data-vkify-glass');
        removeThemeVariables();
        resetLogoColor();
      },
    },

    theme_radius: {
      enable: (value?: unknown) => {
        if (!value || value === 0) return;
        const v = value as number;
        const root = document.documentElement;
        root.style.setProperty('--vkify-block-radius', `${v}px`);
        root.style.setProperty('--vkify-block-radius-half', `${Math.round(v / 2)}px`);
        root.setAttribute('data-vkify-theme-radius', 'true');
      },
      disable: () => {
        const root = document.documentElement;
        root.style.removeProperty('--vkify-block-radius');
        root.style.removeProperty('--vkify-block-radius-half');
        root.removeAttribute('data-vkify-theme-radius');
      },
    },

    block_opacity: {
      enable: async (value?: unknown) => {
        const opacity = typeof value === 'number' ? value : 1;
        const palette = await rebuildPalette({ blockOpacity: opacity });
        if (palette) {
          setThemeVariables(palette);
          updateLogoColor(palette.accent);
        }
        await updateGlassState();
      },
      disable: async () => {
        const palette = await rebuildPalette({ blockOpacity: 1 });
        if (palette) {
          setThemeVariables(palette);
          updateLogoColor(palette.accent);
        }
        document.documentElement.removeAttribute('data-vkify-glass');
        document.documentElement.style.removeProperty('--vkify-glass-blur');
        document.documentElement.style.removeProperty('--vkify-glass-saturate');
      },
    },

    glass_blur: {
      enable: async () => {
        await updateGlassState();
      },
      disable: () => {
        document.documentElement.removeAttribute('data-vkify-glass');
        document.documentElement.style.removeProperty('--vkify-glass-blur');
        document.documentElement.style.removeProperty('--vkify-glass-saturate');
      },
    },

    block_depth: {
      enable: () => {
        document.documentElement.setAttribute('data-vkify-depth', 'true');
      },
      disable: () => {
        document.documentElement.removeAttribute('data-vkify-depth');
      },
    },

    custom_accent: {
      reapplyOnNavigate: true,
      enable: async (color?: unknown) => {
        if (!color) return;
        const colorStr = color as string;
        const settings = await manager.getAllSettings();
        if (settings.custom_theme) {
          const palette = await rebuildPalette({ accentColor: colorStr });
          if (palette) {
            setThemeVariables(palette);
            updateLogoColor(palette.accent);
          }
          return;
        }
        const palette = generateAccentPalette(colorStr);
        setAccentVariables(palette);
        document.documentElement.setAttribute('data-vkify-accent', 'true');
        updateLogoColor(colorStr);
      },
      disable: async () => {
        const settings = await manager.getAllSettings();
        if (settings.custom_theme) {
          const palette = await rebuildPalette({ accentColor: '#0077ff' });
          if (palette) {
            setThemeVariables(palette);
            updateLogoColor(palette.accent);
          }
          return;
        }
        document.documentElement.removeAttribute('data-vkify-accent');
        removeAccentVariables();
        resetLogoColor();
      },
    },
  };
}