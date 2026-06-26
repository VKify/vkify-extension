import type { FeatureManager } from '../core/feature-manager.js';
import { registerAppearanceFeatures } from './appearance/index.js';
import { registerHidingFeatures } from './hiding/index.js';
import { registerPrivacyFeatures } from './privacy/index.js';
import { registerAdsBlockingFeatures } from './ads-blocking/index.js';
import { registerSpyFeatures } from './spy/index.js';
import { registerCustomCssFeatures } from './custom-css/index.js';
import { registerAutomationFeatures } from './automation/index.js';
import { registerCenterFeatures } from './center/index.js';
import { registerPerformanceFeatures } from './performance/index.js';

export function registerAllFeatures(manager: FeatureManager): void {
  registerAppearanceFeatures(manager);
  registerHidingFeatures(manager);
  registerPrivacyFeatures(manager);
  registerAdsBlockingFeatures(manager);
  registerSpyFeatures(manager);
  registerCustomCssFeatures(manager);
  registerAutomationFeatures(manager);
  registerCenterFeatures(manager);
  registerPerformanceFeatures(manager);

  let count = 0;
  manager.forEachFeature(() => count++);
  console.log('[VKify] All features registered:', count);
}