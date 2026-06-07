import type { FeatureManager } from '../../core/feature-manager.js';
import { createMediaPlayerFeature } from './player-control.js';

export function registerPlayerFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createMediaPlayerFeature(manager));
}
