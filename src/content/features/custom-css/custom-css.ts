import type { FeatureContext } from '../../core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';

export function createCustomCSSFeatures(ctx: FeatureContext): FeatureMap {
  return {
    custom_css_enabled: {
      enable: async () => {
        const css = await ctx.getSetting<string>('custom_css');
        if (typeof css === 'string') ctx.injectCSS('custom_css', css);
      },
      disable: () => {
        ctx.removeCSS('custom_css');
      },
    },

    custom_css: {
      enable: async (css?: unknown) => {
        if (!css) return;
        const enabled = await ctx.getSetting<boolean>('custom_css_enabled');
        if (enabled === true) ctx.injectCSS('custom_css', css as string);
      },
      disable: () => {
        ctx.removeCSS('custom_css');
      },
    },
  };
}