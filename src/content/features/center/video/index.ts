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
const SYNC_INTERVAL_MS = 400;

export function createVideoDownloadFeature(ctx: FeatureContext): FeatureMap {
  let off: (() => void) | null = null;
  let syncInterval: ReturnType<typeof setInterval> | null = null;
  let generation = 0;
  let currentData: Awaited<ReturnType<typeof fetchVideoData>> = null;
  let currentKey: string | null = null;
  let requestedKey: string | null = null;

  function stop(): void {
    generation++;
    off?.();
    off = null;
    if (syncInterval !== null) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
    currentData = null;
    currentKey = null;
    requestedKey = null;
    removeUI();
  }

  function syncButton(): void {
    const ids = parseVideoIds(window.location);
    const key = ids ? `${ids.ownerId}_${ids.videoId}` : null;
    // Некоторые переходы между роликами в модалке меняют history без события
    // и без изменения <title>. DOM-observer видит пересборку панели и сам
    // запускает загрузку данных нового video ID.
    if (ids && key !== requestedKey) {
      void loadVideo(ids.ownerId, ids.videoId);
      return;
    }
    if (!currentData || currentKey !== key) return;
    if (!document.getElementById(CONTAINER_ID)) {
      injectButton(currentData.files, currentData.title, setVideoWallpaper);
    } else {
      placeButtonInVideoActions();
    }
  }

  function ensureObserver(): void {
    if (!off) off = ctx.observeChanges('video_download', syncButton);
    // VK может поменять modal history уже после последней DOM-мутации. Poll
    // закрывает эту гонку и помогает в фоновой вкладке, где rAF observer'а не
    // тикает. requestedKey не допускает повторного API-запроса того же видео.
    if (syncInterval === null) syncInterval = setInterval(syncButton, SYNC_INTERVAL_MS);
  }

  function isCurrentVideo(ownerId: number, videoId: number, requestGeneration: number): boolean {
    if (requestGeneration !== generation) return false;
    const current = parseVideoIds(window.location);
    return current?.ownerId === ownerId && current.videoId === videoId;
  }

  async function setVideoWallpaper(url: string): Promise<void> {
    await ctx.setSetting('background_type', 'video');
    await ctx.setSetting('custom_background', url);
  }

  async function loadVideo(ownerId: number, videoId: number): Promise<void> {
    const key = `${ownerId}_${videoId}`;
    requestedKey = key;
    if (currentKey !== key) {
      // Пока обновляются ссылки качества, старая кнопка может оставаться в
      // переиспользованном VK ряду, но клик по URL предыдущего видео запрещаем.
      document.querySelectorAll<HTMLButtonElement>(`#${CONTAINER_ID} button`)
        .forEach(button => { button.disabled = true; });
    }
    const requestGeneration = ++generation;
    let data = await fetchVideoData(ownerId, videoId);

    // Retry — токен может быть не готов при холодном открытии страницы.
    for (const delay of API_RETRY_DELAYS) {
      if (data) break;
      await new Promise<void>(r => setTimeout(r, delay));
      if (!isCurrentVideo(ownerId, videoId, requestGeneration)) return;
      data = await fetchVideoData(ownerId, videoId);
    }

    if (!isCurrentVideo(ownerId, videoId, requestGeneration)) return;
    if (data) {
      currentData = data;
      currentKey = key;
      injectButton(data.files, data.title, setVideoWallpaper);
    } else {
      currentData = null;
      currentKey = null;
      removeUI();
    }
  }

  return {
    video_download: {
      reapplyOnNavigate: true,
      reapplyOnLanguageChange: true,

      enable: async () => {
        const ids = parseVideoIds(window.location);
        if (!ids) { stop(); return; }

        // Не снимаем UI и observer при SPA-переключении видео: VK сначала
        // уничтожает старый action-row, а новый монтирует параллельно с API.
        ensureObserver();
        const key = `${ids.ownerId}_${ids.videoId}`;
        if (key === requestedKey) { syncButton(); return; }
        await loadVideo(ids.ownerId, ids.videoId);
      },

      disable: () => { stop(); },
    },
  };
}
