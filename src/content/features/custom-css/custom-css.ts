import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';

export function createCustomCSSFeatures(manager: FeatureManager): FeatureMap {
  return {
    custom_css_enabled: {
      enable: async () => {
        const css = await manager.getSetting<string>('custom_css');
        if (typeof css === 'string') manager.injectCSS('custom_css', css);
      },
      disable: () => {
        manager.removeCSS('custom_css');
      },
    },

    custom_css: {
      enable: async (css?: unknown) => {
        if (!css) return;
        const enabled = await manager.getSetting<boolean>('custom_css_enabled');
        if (enabled === true) manager.injectCSS('custom_css', css as string);
      },
      disable: () => {
        manager.removeCSS('custom_css');
      },
    },
  };
}