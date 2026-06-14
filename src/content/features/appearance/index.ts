import type { FeatureManager } from '../../core/feature-manager.js';
import { createWidescreenFeatures, createPageOffsetFeature, createCompactSpacingFeature } from './layout/index.js';
import { createSidebarFeatures } from './sidebar/index.js';
import { createHeaderFeatures } from './header/index.js';
import { createThemeFeatures } from './theme/index.js';
import { createBorderRadiusFeature } from './theme/border-radius.js';
import { createBackgroundFeatures } from './background/index.js';
import { createFilterFeatures } from './filters/index.js';
import { createFontFeatures } from './font/index.js';

export function registerAppearanceFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createWidescreenFeatures(manager));
  manager.registerMultiple(createSidebarFeatures(manager));
  manager.registerMultiple(createHeaderFeatures(manager));
  manager.registerMultiple(createThemeFeatures(manager));
  manager.registerMultiple(createBackgroundFeatures(manager));
  manager.registerMultiple(createBorderRadiusFeature(manager));
  manager.registerMultiple(createFilterFeatures(manager));
  manager.registerMultiple(createFontFeatures(manager));
  manager.registerMultiple(createPageOffsetFeature(manager));
  manager.registerMultiple(createCompactSpacingFeature(manager));
}
