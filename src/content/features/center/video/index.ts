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
const URL_SYNC_INTERVAL = 250;

export function createVideoDownloadFeature(ctx: FeatureContext): FeatureMap {
  let off: (() => void) | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let requestId = 0;
  let activeKey = '';
  let currentData: Awaited<ReturnType<typeof fetchVideoData>> = null;

  function stop(): void {
    requestId++;
    off?.();
    off = null;
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
    activeKey = '';
    currentData = null;
    removeUI();
  }

  async function setVideoWallpaper(url: string): Promise<void> {
    await ctx.setSetting('background_type', 'video');
    await ctx.setSetting('custom_background', url);
  }

  function currentVideoKey(): string {
    const ids = parseVideoIds(window.location);
    return ids ? `${ids.ownerId}_${ids.videoId}` : '';
  }

  async function loadCurrentVideo(ownerId: number, videoId: number, key: string): Promise<void> {
    const ownRequestId = ++requestId;
    currentData = null;
    removeUI();

    let data = await fetchVideoData(ownerId, videoId);
    for (const delay of API_RETRY_DELAYS) {
      if (data) break;
      await new Promise<void>(resolve => setTimeout(resolve, delay));
      if (ownRequestId !== requestId || currentVideoKey() !== key) return;
      data = await fetchVideoData(ownerId, videoId);
    }

    if (ownRequestId !== requestId || currentVideoKey() !== key) return;
    if (!data) {
      // Следующий sync попробует ещё раз: токен VK мог оставаться неготовым.
      activeKey = '';
      return;
    }

    currentData = data;
    injectButton(data.files, data.title, setVideoWallpaper);
  }

  function sync(): void {
    const ids = parseVideoIds(window.location);
    if (!ids) {
      if (activeKey) {
        requestId++;
        activeKey = '';
        currentData = null;
        removeUI();
      }
      return;
    }

    const key = `${ids.ownerId}_${ids.videoId}`;
    if (key !== activeKey) {
      activeKey = key;
      void loadCurrentVideo(ids.ownerId, ids.videoId, key);
      return;
    }

    if (!currentData) return;
    if (!document.getElementById(CONTAINER_ID)) {
      injectButton(currentData.files, currentData.title, setVideoWallpaper);
    } else {
      placeButtonInVideoActions();
    }
  }

  function start(): void {
    if (!off) off = ctx.observeChanges('video_download', sync);
    if (interval === null) interval = setInterval(sync, URL_SYNC_INTERVAL);
    sync();
  }

  return {
    video_download: {
      reapplyOnNavigate: true,
      reapplyOnLanguageChange: true,

      enable: () => { start(); },

      disable: () => { stop(); },
    },
  };
}
