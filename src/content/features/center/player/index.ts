import type { FeatureManager } from '@/content/core/feature-manager.js';
import { createMediaPlayerFeature } from './player-control.js';
import { createAudioAutoplayFeature } from './autoplay.js';
import { createAudioEqualizerFeature } from './equalizer/index.js';

export function registerPlayerFeatures(manager: FeatureManager): void {
  manager.registerHandlerMap(createMediaPlayerFeature(manager));
  manager.registerHandlerMap(createAudioAutoplayFeature(manager));
  manager.registerHandlerMap(createAudioEqualizerFeature(manager));
}
