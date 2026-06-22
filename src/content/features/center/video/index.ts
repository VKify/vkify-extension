/**
 * Скачивание видео с vkvideo.ru — плавающая кнопка «Скачать» с пикером
 * качества 1080p…240p. Прямые ссылки берутся через `video.get`.
 *
 * Файл собирает фичу из модулей: api · button.
 */

import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';
import { parseVideoIds, fetchVideoData } from './api.js';
import { injectButton, removeUI } from './button.js';

export function createVideoDownloadFeature(_manager: FeatureManager): FeatureMap {
  return {
    video_download: {
      reapplyOnNavigate: true,

      enable: async () => {
        if (window.location.hostname !== 'vkvideo.ru') { removeUI(); return; }
        const ids = parseVideoIds(window.location.pathname);
        if (!ids) { removeUI(); return; }

        const startPath = window.location.pathname;
        let data = await fetchVideoData(ids.ownerId, ids.videoId);

        // Retry — токен может быть не готов при холодном открытии страницы.
        if (!data) {
          await new Promise<void>(r => setTimeout(r, 3000));
          if (window.location.pathname !== startPath) return;
          data = await fetchVideoData(ids.ownerId, ids.videoId);
        }

        if (window.location.pathname !== startPath) return;
        if (data) injectButton(data.files, data.title);
      },

      disable: () => { removeUI(); },
    },
  };
}
