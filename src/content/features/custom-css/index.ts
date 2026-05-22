import type { FeatureManager } from '../../core/feature-manager.js';
import { createCustomCSSFeatures } from './custom-css.js';

export function registerCustomCssFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createCustomCSSFeatures(manager));
}