import type { FeatureManager } from '../../core/feature-manager.js';
import { createMediaPlayerFeature } from './player-control.js';
import { createVideoDownloadFeature } from './video-download.js';

export function registerMediaFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createMediaPlayerFeature(manager));
  manager.registerMultiple(createVideoDownloadFeature(manager));
}