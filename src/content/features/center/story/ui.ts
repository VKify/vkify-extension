/**
 * Кнопка скачивания в шапке плеера сторис: фото → JPEG, видео → пикер качества.
 *
 * Migrated to new DOM layer: якоря панели действий вынесены в SELECTORS.story.
 */

import {
  fillQualityRows,
  requestDownload,
  sanitizeFilename,
  buildDownloadIconSvg,
  attachBrandTooltip,
  removeBrandTooltip,
  type VideoQualityFiles,
} from '../_shared/index.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { BUTTON_ID, DROPDOWN_ID, STYLE_ID } from './constants.js';
import { getBestPhotoUrl } from './api.js';
import type { StoryItem } from './types.js';
import { t } from '@/content/i18n/index.js';

/** Слушатель закрытия дропдауна на module-level, чтобы removeUI() мог его снять. */
let _closeDropdown: (() => void) | null = null;

function findActionsContainer(): Element | null {
  return safeQuerySelector(SELECTORS.story.menuIconInSelected)?.parentElement ?? null;
}

export function removeUI(): void {
  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(DROPDOWN_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  removeBrandTooltip();
  if (_closeDropdown) {
    document.removeEventListener('click', _closeDropdown);
    _closeDropdown = null;
  }
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
    /* Дропдаун — единая карточка VKify (ui/floating-card.ts); поверх плеера сторис. */
    #${DROPDOWN_ID} { min-width: 130px; z-index: 2147483647; animation: vkify-card-drop .15s ease; }
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
  btn.setAttribute('aria-label', t('download.story.aria'));
  attachBrandTooltip(btn, t('download.story.aria'));
  btn.appendChild(buildDownloadIconSvg(24));

  const menuBtn = safeQuerySelector(SELECTORS.story.menuIcon, actionsContainer);
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
    dropdown.className = 'vkify-card vkify-card__list';
    if (fillQualityRows(dropdown, files, baseFilename, closeDropdown) === 0) return;

    // position:fixed + getBoundingClientRect — обходит overflow:hidden у предков.
    const rect = btn.getBoundingClientRect();
    dropdown.style.top   = `${rect.bottom + 6}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(dropdown);
    open = true;
  });
}

export function injectFromData(story: StoryItem, ids: { ownerId: number; storyId: number }): void {
  removeUI();
  if (story.type === 'photo' && story.photo) {
    const url = getBestPhotoUrl(story.photo.sizes);
    if (url) injectPhotoButton(url, ids.ownerId, ids.storyId);
  } else if (story.type === 'video' && story.video?.files) {
    injectVideoButton(story.video.files, ids.ownerId, ids.storyId, story.video.title);
  }
}
