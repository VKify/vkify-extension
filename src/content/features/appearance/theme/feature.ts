/**
 * Регистрация фич оформления (тема/акцент/радиус/прозрачность/стекло/глубина):
 * применение CSS-переменных к <html>, перекраска логотипа ВК и glass-эффект.
 * Сама палитра считается в palette.ts, маппинг в переменные — в vars.ts.
 */

import type { FeatureManager } from '../../../core/feature-manager.js';
import type { FeatureMap, ThemePalette, AccentPalette } from '../../../../types/index.js';
import { clamp, generateThemePalette, generateAccentPalette } from './palette.js';
import {
  themePaletteToVars, accentPaletteToVars,
  THEME_VAR_NAMES, ACCENT_VAR_NAMES,
} from './vars.js';

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
