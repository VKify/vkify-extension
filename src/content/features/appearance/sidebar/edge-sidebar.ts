import { derivedCssFeature } from '@/content/core/features/index.js';
import { EDGE_SIDEBAR_DEFAULTS, isEdgeSidebarColor } from '@/shared/edge-sidebar.js';

export function buildEdgeSidebarVars(settings: Record<string, unknown>): Record<string, string> {
  const number = (key: keyof typeof EDGE_SIDEBAR_DEFAULTS, min: number, max: number): number => {
    const value = settings[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value)) : Number(EDGE_SIDEBAR_DEFAULTS[key]);
  };
  const width = number('edge_sidebar_width', 0, 300);
  const opacity = number('edge_sidebar_opacity', 0, 100);
  const mode = settings.edge_sidebar_background;
  const custom = mode === 'custom';
  const color = isEdgeSidebarColor(settings.edge_sidebar_color)
    ? settings.edge_sidebar_color : EDGE_SIDEBAR_DEFAULTS.edge_sidebar_color;
  const theme = 'color-mix(in srgb, var(--vkui--color_background_content, #fff) 92%, var(--vkui--color_accent_blue, #07f))';
  // Translucent panels retain theme text: wallpaper determines their contrast.
  const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  return {
    '--vkify-edge-custom-width': width === 0 ? 'clamp(156px, 18vw, 204px)' : `${Math.max(156, width)}px`,
    '--vkify-edge-background': mode === 'transparent' ? 'transparent'
      : `color-mix(in srgb, ${custom ? color : theme} ${opacity}%, transparent)`,
    '--vkify-edge-text': custom && opacity >= 90 ? (luminance > .179 ? '#111111' : '#ffffff') : 'var(--vkui--color_text_primary, inherit)',
    '--vkify-edge-blur': mode === 'transparent' ? '0px' : `${number('edge_sidebar_blur', 0, 40)}px`,
    '--vkify-edge-item-radius': `${number('edge_sidebar_item_radius', 0, 24)}px`,
    '--vkify-edge-item-height': `${number('edge_sidebar_item_height', 32, 56)}px`,
  };
}

export const edgeSidebarFeature = derivedCssFeature({
  id: 'edge_sidebar',
  name: 'Меню у края',
  category: 'appearance',
  cssFiles: 'appearance/sidebar/edge-sidebar.css',
  watch: Object.keys(EDGE_SIDEBAR_DEFAULTS),
  reapplyOnUpdate: true,
  compute: settings => ({ vars: buildEdgeSidebarVars(settings) }),
});
