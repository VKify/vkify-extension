import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

export function createBlurOnUnfocusFeature(manager: FeatureManager): FeatureMap {
  return {
    blur_on_unfocus: {
      enable: () => {
        manager.injectCSS('blur_on_unfocus', `
          html { filter: blur(10px) !important; }
          html:hover { filter: blur(0) !important; }
        `);
      },
      disable: () => manager.removeCSS('blur_on_unfocus'),
    },
  };
}