import type { FeatureManager } from '../../core/feature-manager.js';
import { createVideoDownloadFeature } from './video/index.js';
import { createStoryDownloadFeature } from './story/index.js';
import { createClipDownloadFeature } from './clip/index.js';
import { createPhotoDownloadFeature } from './photo/index.js';
import { createAudioDownloadFeature, createAudioMultiUploadFeature } from './audio/index.js';

export function registerMediaFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createVideoDownloadFeature(manager));
  manager.registerMultiple(createStoryDownloadFeature(manager));
  manager.registerMultiple(createClipDownloadFeature(manager));
  manager.registerMultiple(createPhotoDownloadFeature(manager));
  manager.registerMultiple(createAudioDownloadFeature(manager));
  manager.registerMultiple(createAudioMultiUploadFeature());
}