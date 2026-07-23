/**
 * Скачивание видео — плавающая кнопка «Скачать» с пикером качества
 * 1080p…240p. Прямые ссылки берутся через `video.get`.
 *
 * Работает и на страницах vkvideo.ru (/video-123_456), и в модальном
 * плеере vk.ru (любой путь + ?z=video-123_456 — в т.ч. обёртки вида
 * vk.ru/vkify?z=video-…). NavigationService сравнивает полный href, поэтому
 * открытие/закрытие модалки (меняется только query) переактивирует фичу.
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
      reapplyOnLanguageChange: true,

      enable: async () => {
        const ids = parseVideoIds(window.location);
        if (!ids) { removeUI(); return; }

        // Guard от гонок: URL мог смениться, пока ждали API (модалку закрыли).
        const startUrl = window.location.href;
        let data = await fetchVideoData(ids.ownerId, ids.videoId);

        // Retry — токен может быть не готов при холодном открытии страницы.
        if (!data) {
          await new Promise<void>(r => setTimeout(r, 3000));
          if (window.location.href !== startUrl) return;
          data = await fetchVideoData(ids.ownerId, ids.videoId);
        }

        if (window.location.href !== startUrl) return;
        if (data) injectButton(data.files, data.title);
      },

      disable: () => { removeUI(); },
    },
  };
}
