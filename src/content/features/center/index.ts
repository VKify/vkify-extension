import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { registerProfileFeatures } from './profile/index.js';
import { registerCommunitiesFeatures } from './communities/index.js';
import { registerMessagesFeatures } from './messages/index.js';
import { registerFeedFeatures } from './feed/index.js';
import { createVideoDownloadFeature } from './video/index.js';
import { createClipDownloadFeature } from './clip/index.js';
import { createPhotoDownloadFeature } from './photo/index.js';
import { registerMusicFeatures } from './music/index.js';

/**
 * Фичи хаба «Центр» — зеркалит структуру одноимённой вкладки попапа:
 * каждая подпапка соответствует странице хаба.
 *   profile → «Профиль», messages → «Мессенджер», communities → «Сообщества»,
 *   music → «Музыка» (скачивание, загрузка, визуализация и управление плеером), feed → «Лента»
 *   (скачивание историй живёт там же), video → «Видео», clip → «Клипы»,
 *   photo → «Фото».
 * Новая страница хаба = новая подпапка + регистрация здесь.
 */
export function registerCenterFeatures(manager: FeatureManager): void {
  registerProfileFeatures(manager);
  registerMessagesFeatures(manager);
  registerCommunitiesFeatures(manager);
  registerMusicFeatures(manager);
  registerFeedFeatures(manager);
  // Скачивание/загрузка: медиа-пайплайны не переписываются — оборачиваются
  // handlerFeature с метадатой на месте.
  const video = createVideoDownloadFeature(manager);
  const clip = createClipDownloadFeature(manager);
  const photo = createPhotoDownloadFeature(manager);

  manager.registerDefinitions([
    handlerFeature({
      id: 'video_download',
      name: 'Скачивание видео', category: 'media', impact: 'medium',
      requiresDomLayer: true, tags: ['download', 'video'],
      handler: video.video_download,
    }),
    handlerFeature({
      id: 'clip_download',
      name: 'Скачивание клипов', category: 'media', impact: 'medium',
      requiresDomLayer: true, tags: ['download', 'clip'],
      handler: clip.clip_download,
    }),
    handlerFeature({
      id: 'photo_download',
      name: 'Скачивание фото', category: 'media', impact: 'medium',
      requiresDomLayer: true, tags: ['download', 'photo'],
      handler: photo.photo_download,
    }),
  ]);
}
