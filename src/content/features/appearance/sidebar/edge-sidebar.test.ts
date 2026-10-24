import { describe, expect, it } from 'vitest';
import { buildEdgeSidebarVars, edgeSidebarFeature } from './edge-sidebar.js';
import { EDGE_SIDEBAR_DEFAULTS } from '@/shared/edge-sidebar.js';
import { isValidSettingValue } from '@/shared/constants/settings-schema.js';
import { buildThemePatch } from '@/shared/constants/appearance.js';
import { buildApplyPatch, captureAppearance } from '@/popup/utils/appearanceProfile.js';

describe('edge sidebar appearance', () => {
  it('preserves responsive defaults for existing installations', () => {
    const vars = buildEdgeSidebarVars({});
    expect(vars['--vkify-edge-custom-width']).toBe('clamp(156px, 18vw, 204px)');
    expect(vars['--vkify-edge-background']).toContain('var(--vkui--color_background_content, #fff)');
    expect(vars['--vkify-edge-item-height']).toBe('38px');
    expect(edgeSidebarFeature.settingsKeys).toEqual(['edge_sidebar', ...Object.keys(EDGE_SIDEBAR_DEFAULTS)]);
  });

  it('chooses readable text and discards unsafe colors and invalid numbers', () => {
    expect(buildEdgeSidebarVars({ edge_sidebar_background: 'custom', edge_sidebar_color: '#ffffff' })['--vkify-edge-text']).toBe('#111111');
    expect(buildEdgeSidebarVars({ edge_sidebar_background: 'custom', edge_sidebar_color: '#000000' })['--vkify-edge-text']).toBe('#ffffff');
    const vars = buildEdgeSidebarVars({ edge_sidebar_background: 'custom', edge_sidebar_color: 'red;display:none', edge_sidebar_width: NaN, edge_sidebar_blur: Infinity, edge_sidebar_item_height: -10 });
    expect(vars['--vkify-edge-background']).toContain('#1f2937');
    expect(vars['--vkify-edge-custom-width']).not.toContain('NaN');
    expect(vars['--vkify-edge-blur']).toBe('0px');
    expect(vars['--vkify-edge-item-height']).toBe('32px');
    expect(buildEdgeSidebarVars({ edge_sidebar_background: 'transparent', edge_sidebar_blur: 40 })['--vkify-edge-blur']).toBe('0px');
    expect(isValidSettingValue('edge_sidebar_color', 'red;display:none', 'theme')).toBe(false);
    expect(isValidSettingValue('edge_sidebar_width', 100, 'theme')).toBe(false);
  });

  it('restores custom appearance from profiles and resets omitted theme values', () => {
    const custom = { ...EDGE_SIDEBAR_DEFAULTS, edge_sidebar_width: 260, edge_sidebar_background: 'custom' as const, edge_sidebar_color: '#abcdef', edge_sidebar_opacity: 72, edge_sidebar_blur: 16, edge_sidebar_item_radius: 20, edge_sidebar_item_height: 48 };
    expect(buildApplyPatch(captureAppearance(custom))).toMatchObject(custom);
    expect(buildThemePatch({})).toMatchObject(EDGE_SIDEBAR_DEFAULTS);
    for (const [key, value] of Object.entries(custom)) expect(isValidSettingValue(key, value, 'theme'), key).toBe(true);
  });
});
