import type { FeatureManager } from '@/content/core/feature-manager.js';
import { createMediaPlayerFeature } from './player-control.js';
import { createAudioAutoplayFeature } from './autoplay.js';

export function registerPlayerFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createMediaPlayerFeature(manager));
  manager.registerMultiple(createAudioAutoplayFeature(manager));
}
