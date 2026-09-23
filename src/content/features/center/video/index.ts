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

import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { parseVideoIds, fetchVideoData } from './api.js';
import { injectButton, placeButtonInVideoActions, removeUI } from './button.js';
import { CONTAINER_ID } from './constants.js';

// При холодном старте первый video.get иногда опережает готовность токена.
// Короткие ранние повторы показывают кнопку заметно быстрее прежней паузы 3 с,
// сохраняя примерно то же суммарное окно ожидания для медленного старта.
const API_RETRY_DELAYS = [250, 750, 2000] as const;

export function createVideoDownloadFeature(ctx: FeatureContext): FeatureMap {
  let off: (() => void) | null = null;

  function stop(): void {
    off?.();
    off = null;
    removeUI();
  }

  async function setVideoWallpaper(url: string): Promise<void> {
    await ctx.setSetting('background_type', 'video');
    await ctx.setSetting('custom_background', url);
  }

  return {
    video_download: {
      reapplyOnNavigate: true,
      reapplyOnLanguageChange: true,

      enable: async () => {
        stop();
        const ids = parseVideoIds(window.location);
        if (!ids) return;

        // Guard от гонок: URL мог смениться, пока ждали API (модалку закрыли).
        const startUrl = window.location.href;
        let data = await fetchVideoData(ids.ownerId, ids.videoId);

        // Retry — токен может быть не готов при холодном открытии страницы.
        for (const delay of API_RETRY_DELAYS) {
          if (data) break;
          await new Promise<void>(r => setTimeout(r, delay));
          if (window.location.href !== startUrl) return;
          data = await fetchVideoData(ids.ownerId, ids.videoId);
        }

        if (window.location.href !== startUrl) return;
        if (data) {
          injectButton(data.files, data.title, setVideoWallpaper);
          // VK монтирует и заменяет action-row асинхронно. Перемещаем тот же
          // корень кнопки при появлении/перерисовке панели, не создавая дублей.
          off = ctx.observeChanges('video_download', () => {
            if (!document.getElementById(CONTAINER_ID)) {
              injectButton(data.files, data.title, setVideoWallpaper);
            } else {
              placeButtonInVideoActions();
            }
          });
        }
      },

      disable: () => { stop(); },
    },
  };
}
