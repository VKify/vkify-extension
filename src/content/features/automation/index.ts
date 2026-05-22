import type { FeatureManager } from '../../core/feature-manager.js';
import { createAutoAddFriendsFeature } from './auto-add-friends.js';
import { createBypassAwayLinksFeature } from './bypass-away-links.js';
import { createKeyboardLayoutFeature } from './keyboard-layout.js';

export function registerAutomationFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createAutoAddFriendsFeature(manager));
  manager.registerMultiple(createBypassAwayLinksFeature(manager));
  manager.registerMultiple(createKeyboardLayoutFeature(manager));
}