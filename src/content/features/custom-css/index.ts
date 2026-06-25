import type { FeatureManager } from '../../core/feature-manager.js';
import { createCustomCSSFeatures } from './custom-css.js';

export function registerCustomCssFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createCustomCSSFeatures(manager));

  manager.describeFeatures({
    custom_css_enabled: {
      // light: inject-CSS из пользовательского текста статичен после применения.
      name: 'Пользовательский CSS', category: 'custom-css', impact: 'light',
      initOrder: 110, tags: ['css', 'user'],
    },
  });
}