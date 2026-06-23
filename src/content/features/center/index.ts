import type { FeatureManager } from '../../core/feature-manager.js';
import { registerMessagesFeatures } from './messages/index.js';
import { registerPlayerFeatures } from './player/index.js';
import { registerFeedFeatures } from './feed/index.js';
import { createVideoDownloadFeature } from './video/index.js';
import { createClipDownloadFeature } from './clip/index.js';
import { createPhotoDownloadFeature } from './photo/index.js';
import { createAudioDownloadFeature, createAudioMultiUploadFeature } from './music/index.js';

/**
 * Фичи хаба «Центр» — зеркалит структуру одноимённой вкладки попапа:
 * каждая подпапка соответствует странице хаба.
 *   messages → «Мессенджер», player → «Плеер», feed → «Лента»
 *   (скачивание историй живёт там же), video → «Видео», clip → «Клипы»,
 *   photo → «Фото», music → «Музыка» (скачивание MP3 + мульти-загрузка).
 * Новая страница хаба = новая подпапка + регистрация здесь.
 */
export function registerCenterFeatures(manager: FeatureManager): void {
  registerMessagesFeatures(manager);
  registerPlayerFeatures(manager);
  registerFeedFeatures(manager);
  manager.registerMultiple(createVideoDownloadFeature(manager));
  manager.registerMultiple(createClipDownloadFeature(manager));
  manager.registerMultiple(createPhotoDownloadFeature(manager));
  manager.registerMultiple(createAudioDownloadFeature(manager));
  manager.registerMultiple(createAudioMultiUploadFeature(manager));
}
