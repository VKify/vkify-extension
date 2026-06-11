import type { FeatureManager } from '../../core/feature-manager.js';
import { createWidescreenFeatures } from './widescreen.js';
import { createSidebarFeatures } from './sidebar.js';
import { createHeaderFeatures } from './header.js';
import { createThemeFeatures } from './theme.js';
import { createBackgroundFeatures } from './background.js';
import { createBorderRadiusFeature } from './border-radius.js';
import { createFilterFeatures } from './filters.js';
import { createFontFeatures } from './fontManager.js';
import { createPageOffsetFeature } from './page-offset.js';
import { createCompactSpacingFeature } from './compact-spacing.js';

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