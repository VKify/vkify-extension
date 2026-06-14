import type { FeatureManager } from '../../core/feature-manager.js';
import { createAntiTrackingFeatures } from './anti-tracking.js';
import { createHideDialogsHotkeyFeature } from './dialogs/hide-dialogs-hotkey.js';
import { createBlurOnUnfocusFeature } from './blur-on-unfocus.js';
import { createHideSpecificDialogsFeature } from './dialogs/hide-specific-dialogs.js';
import { createMessageCryptoFeature } from './crypto/message-crypto.js';

export function registerPrivacyFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createAntiTrackingFeatures(manager));
  manager.registerMultiple(createHideDialogsHotkeyFeature(manager));
  manager.registerMultiple(createBlurOnUnfocusFeature(manager));
  manager.registerMultiple(createHideSpecificDialogsFeature(manager));
  manager.registerMultiple(createMessageCryptoFeature(manager));
}