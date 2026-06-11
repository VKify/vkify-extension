import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';

/** Размытие страницы при потере фокуса (CSS — blur-on-unfocus.css). */
export function createBlurOnUnfocusFeature(manager: FeatureManager): FeatureMap {
  return {
    blur_on_unfocus: {
      enable: () => manager.enableCss('blur_on_unfocus'),
      disable: () => manager.disableCss('blur_on_unfocus'),
    },
  };
}
