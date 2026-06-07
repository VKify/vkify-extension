/**
 * Скачивание сторис на vk.com — кнопка в панели управления плеера, рядом с «⋯».
 * Фото-сторис → один JPEG; видео-сторис → пикер качества 1080p…240p.
 */

import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { vkApi } from '../../api/vk-api-client.js';
import {
  fillQualityRows,
  QUALITY_DROPDOWN_CSS,
  requestDownload,
  sanitizeFilename,
  buildDownloadIconSvg,
  attachBrandTooltip,
  removeBrandTooltip,
  type VideoQualityFiles,
} from './_shared.js';

const BUTTON_ID   = 'vkify-story-dl-btn';
const DROPDOWN_ID = 'vkify-story-dl-dd';
const STYLE_ID    = 'vkify-story-dl-style';

interface PhotoSize { url: string; width: number; type: string }

interface StoryItem {
  id:        number;
  owner_id:  number;
  type:      'photo' | 'video';
  photo?:    { sizes: PhotoSize[] };
  video?:    { title?: string; files?: VideoQualityFiles };
}

interface StoriesGetByIdResponse { count: number; items: StoryItem[] }

/** Слушатель закрытия дропдауна на module-level, чтобы removeUI() мог его снять. */
let _closeDropdown: (() => void) | null = null;

/** Парсит `?w=story-213482001_456240063%2Ffeed` → `{ownerId, storyId}`. */
function parseStoryIds(search: string): { ownerId: number; storyId: number } | null {
  const w = new URLSearchParams(search).get('w');
  if (!w) return null;
  const m = w.match(/^story(-?\d+)_(\d+)/);
  if (!m) return null;
  return { ownerId: Number(m[1]), storyId: Number(m[2]) };
}

function findActionsContainer(): Element | null {
  return document
    .querySelector('[data-testid="stories-gallery-selected-item"] [data-testid="stories_viewer_menu_icon"]')
    ?.parentElement ?? null;
}

function removeUI(): void {
  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(DROPDOWN_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  removeBrandTooltip();
  if (_closeDropdown) {
    document.removeEventListener('click', _closeDropdown);
    _closeDropdown = null;
  }
}

async function fetchStoryData(ownerId: number, storyId: number): Promise<StoryItem | null> {
  try {
    const resp = await vkApi.call('stories.getById', {
      stories:  `${ownerId}_${storyId}`,
      extended: 0,
    }) as StoriesGetByIdResponse;
    return resp?.items?.[0] ?? null;
  } catch {
    return null;
  }
}

function getBestPhotoUrl(sizes: PhotoSize[]): string | null {
  if (!sizes.length) return null;
  return [...sizes].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url;
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BUTTON_ID} {
      background: transparent; border: none; color: #fff;
      width: 40px; height: 40px; min-width: 40px; min-height: 40px;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      border-radius: 50%; transition: background 0.1s; padding: 0; outline: none; flex-shrink: 0;
    }
    #${BUTTON_ID}:hover { background: rgba(255,255,255,0.15); }
    @keyframes vkify-s-dd-fadein {
      from { opacity: 0; transform: translateY(-4px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    #${DROPDOWN_ID} { ${QUALITY_DROPDOWN_CSS} animation: vkify-s-dd-fadein 0.12s ease; }
  `;
  document.head.appendChild(style);
}

function createHeaderButton(): HTMLButtonElement | null {
  const actionsContainer = findActionsContainer();
  if (!actionsContainer) return null;

  injectStyle();

  const btn = document.createElement('button');
  btn.id    = BUTTON_ID;
  btn.type  = 'button';
  btn.setAttribute('aria-label', 'Скачать сторис');
  attachBrandTooltip(btn, 'Скачать сторис');
  btn.appendChild(buildDownloadIconSvg(24));

  const menuBtn = actionsContainer.querySelector('[data-testid="stories_viewer_menu_icon"]');
  actionsContainer.insertBefore(btn, menuBtn ?? null);
  return btn;
}

function injectPhotoButton(url: string, ownerId: number, storyId: number): void {
  const btn = createHeaderButton();
  if (!btn) return;
  btn.addEventListener('click', () => {
    requestDownload(url, `story_${ownerId}_${storyId}.jpg`);
  });
}

function injectVideoButton(
  files: VideoQualityFiles,
  ownerId: number,
  storyId: number,
  title?: string,
): void {
  const btn = createHeaderButton();
  if (!btn) return;

  const baseFilename = title ? sanitizeFilename(title) : `story_${ownerId}_${storyId}`;
  let open = false;

  const closeDropdown = (): void => {
    if (!open) return;
    open = false;
    document.getElementById(DROPDOWN_ID)?.remove();
  };
  _closeDropdown = closeDropdown;
  document.addEventListener('click', closeDropdown);

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (open) { closeDropdown(); return; }

    const dropdown = document.createElement('div');
    dropdown.id = DROPDOWN_ID;
    if (fillQualityRows(dropdown, files, baseFilename, closeDropdown) === 0) return;

    // position:fixed + getBoundingClientRect — обходит overflow:hidden у предков.
    const rect = btn.getBoundingClientRect();
    dropdown.style.top   = `${rect.bottom + 6}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(dropdown);
    open = true;
  });
}

function injectFromData(story: StoryItem, ids: { ownerId: number; storyId: number }): void {
  removeUI();
  if (story.type === 'photo' && story.photo) {
    const url = getBestPhotoUrl(story.photo.sizes);
    if (url) injectPhotoButton(url, ids.ownerId, ids.storyId);
  } else if (story.type === 'video' && story.video?.files) {
    injectVideoButton(story.video.files, ids.ownerId, ids.storyId, story.video.title);
  }
}

export function createStoryDownloadFeature(_manager: FeatureManager): FeatureMap {
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
