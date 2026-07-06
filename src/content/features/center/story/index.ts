/**
 * Скачивание сторис на vk.com — кнопка в панели управления плеера, рядом с «⋯».
 * Фото-сторис → один JPEG; видео-сторис → пикер качества 1080p…240p.
 *
 * Файл собирает фичу из модулей: api · ui.
 */

import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { parseStoryIds, fetchStoryData } from './api.js';
import { removeUI, injectFromData } from './ui.js';
import { BUTTON_ID } from './constants.js';
import type { StoryItem } from './types.js';

export function createStoryDownloadFeature(_ctx: FeatureContext): FeatureMap {
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  // generation отменяет устаревшие fetch'и при быстрой навигации между сторис.
  let generation = 0;
  // Кэш для re-inject'а при перерендере карточки без навигации.
  let cachedStory: StoryItem | null = null;
  let cachedIds:   { ownerId: number; storyId: number } | null = null;

  async function runInject(search: string, myGen: number): Promise<void> {
    const ids = parseStoryIds(search);
    if (!ids) {
      removeUI();
      cachedStory = null;
      cachedIds   = null;
      return;
    }
    cachedIds = ids;

    let story = await fetchStoryData(ids.ownerId, ids.storyId);
    if (myGen !== generation) return;

    if (!story) {
      await new Promise<void>(r => setTimeout(r, 2000));
      if (myGen !== generation) return;
      story = await fetchStoryData(ids.ownerId, ids.storyId);
    }
    if (myGen !== generation || !story) return;

    cachedStory = story;
    injectFromData(story, ids);
  }

  function stopPoll(): void {
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  return {
    story_download: {
      reapplyOnNavigate: true,
      reapplyOnLanguageChange: true,

      enable: async () => {
        stopPoll();
        generation++;
        removeUI();
        cachedStory = null;
        cachedIds   = null;

        const { hostname } = window.location;
        if (hostname !== 'vk.com' && hostname !== 'vk.ru') return;

        // VK навигация по сторис идёт через pushState из page-контекста — патч
        // history из content-script ненадёжен, опрашиваем location.search.
        let lastSearch = window.location.search;
        void runInject(lastSearch, generation);

        pollInterval = setInterval(() => {
          const current = window.location.search;
          if (current !== lastSearch) {
            lastSearch  = current;
            generation++;
            cachedStory = null;
            cachedIds   = null;
            removeUI();
            void runInject(current, generation);
          } else if (cachedStory && cachedIds && !document.getElementById(BUTTON_ID)) {
            // Та же сторис, VK перерисовал карточку — re-inject из кэша.
            injectFromData(cachedStory, cachedIds);
          }
        }, 300);
      },

      disable: () => {
        stopPoll();
        generation++;
        removeUI();
        cachedStory = null;
        cachedIds   = null;
      },
    },
  };
}
