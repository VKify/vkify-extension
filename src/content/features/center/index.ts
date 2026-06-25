import type { FeatureManager } from '../../core/feature-manager.js';
import { registerProfileFeatures } from './profile/index.js';
import { registerCommunitiesFeatures } from './communities/index.js';
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
 *   profile → «Профиль», messages → «Мессенджер», communities → «Сообщества»,
 *   player → «Плеер», feed → «Лента»
 *   (скачивание историй живёт там же), video → «Видео», clip → «Клипы»,
 *   photo → «Фото», music → «Музыка» (скачивание MP3 + мульти-загрузка).
 * Новая страница хаба = новая подпапка + регистрация здесь.
 */
export function registerCenterFeatures(manager: FeatureManager): void {
  registerProfileFeatures(manager);
  registerMessagesFeatures(manager);
  registerCommunitiesFeatures(manager);
  registerPlayerFeatures(manager);
  registerFeedFeatures(manager);
  manager.registerMultiple(createVideoDownloadFeature(manager));
  manager.registerMultiple(createClipDownloadFeature(manager));
  manager.registerMultiple(createPhotoDownloadFeature(manager));
  manager.registerMultiple(createAudioDownloadFeature(manager));
  manager.registerMultiple(createAudioMultiUploadFeature(manager));

  // Метадата раздела «Центр» — все медиа-фичи навешивают плавающие кнопки/
  // обработчики поверх контента, отсюда matchPath-активация и reapplyOnNavigate.
  manager.describeFeatures({
    // impact по реальному механизму: пассивные хоткеи = light; кнопки через
    // observeChanges/интервал = medium; тяжёлая работа (HLS/ZIP) идёт на клик, а
    // не в рантайме фичи, поэтому скачивание — medium, не heavy.
    media_player_hotkeys: { name: 'Горячие клавиши плеера', category: 'media', impact: 'light',  tags: ['hotkeys', 'audio'] },
    audio_autoplay:       { name: 'Автозапуск музыки',      category: 'media', impact: 'light',  tags: ['audio', 'autoplay'] },
    video_download:       { name: 'Скачивание видео',       category: 'media', impact: 'medium', requiresDomLayer: true, tags: ['download', 'video'] },
    clip_download:        { name: 'Скачивание клипов',      category: 'media', impact: 'medium', requiresDomLayer: true, tags: ['download', 'clip'] },
    photo_download:       { name: 'Скачивание фото',        category: 'media', impact: 'medium', requiresDomLayer: true, tags: ['download', 'photo'] },
    audio_download:       { name: 'Скачивание музыки',      category: 'media', impact: 'medium', requiresDomLayer: true, tags: ['download', 'audio', 'hls'] },
    audio_multi_upload:   { name: 'Мульти-загрузка аудио',  category: 'media', impact: 'medium', tags: ['upload', 'audio'] },
  });
}
