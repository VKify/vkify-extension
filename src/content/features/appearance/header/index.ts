import type { FeatureManager } from '../../../core/feature-manager.js';
import type { FeatureMap } from '../../../../types/index.js';

/** Сворачивание поиска в шапке VK (CSS — header.css). */
export function createHeaderFeatures(manager: FeatureManager): FeatureMap {
  return {
    collapse_search: {
      enable: () => manager.enableCss('collapse_search'),
      disable: () => manager.disableCss('collapse_search'),
    },
  };
}
