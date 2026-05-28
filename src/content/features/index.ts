import type { FeatureManager } from '../core/feature-manager.js';
import { registerAppearanceFeatures } from './appearance/index.js';
import { registerPrivacyFeatures } from './privacy/index.js';
import { registerAdsBlockingFeatures } from './ads-blocking/index.js';
import { registerSpyFeatures } from './spy/index.js';
import { registerCustomCssFeatures } from './custom-css/index.js';
import { registerAutomationFeatures } from './automation/index.js';
import { registerMediaFeatures } from './media/index.js';
import { registerMessageTemplatesFeatures } from './templates/templates.js';
import { registerQuickCopyFeature } from './messages/quick-copy.js';
import { registerDialogExportFeature } from './messages/dialog-export.js';
import { registerPinNoteFeature } from './messages/pin-note.js';

export function registerAllFeatures(manager: FeatureManager): void {
  registerAppearanceFeatures(manager);
  registerPrivacyFeatures(manager);
  registerAdsBlockingFeatures(manager);
  registerSpyFeatures(manager);
  registerCustomCssFeatures(manager);
  registerAutomationFeatures(manager);
  registerMediaFeatures(manager);
  registerMessageTemplatesFeatures(manager);
  registerQuickCopyFeature(manager);
  registerDialogExportFeature(manager);
  registerPinNoteFeature(manager);

  let count = 0;
  manager.forEachFeature(() => count++);
  console.log('[VKify] All features registered:', count);
}