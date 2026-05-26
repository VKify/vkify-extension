import type { FeatureManager } from '../../core/feature-manager.js';
import { createMediaPlayerFeature } from './player-control.js';
import { createVideoDownloadFeature } from './video-download.js';
import { createStoryDownloadFeature } from './story-download.js';
import { createClipDownloadFeature } from './clip-download.js';

export function registerMediaFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createMediaPlayerFeature(manager));
  manager.registerMultiple(createVideoDownloadFeature(manager));
  manager.registerMultiple(createStoryDownloadFeature(manager));
  manager.registerMultiple(createClipDownloadFeature(manager));
}