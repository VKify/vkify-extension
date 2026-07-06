/**
 * Кнопка скачивания в панели управления клипами + дропдаун качества.
 *
 * Migrated to new DOM layer: якоря панели управления вынесены в SELECTORS.clip.
 */

import {
  fillQualityRows,
  sanitizeFilename,
  buildDownloadIconSvg,
  attachBrandTooltip,
  removeBrandTooltip,
} from '../_shared/index.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { t } from '@/content/i18n/index.js';
import { BTN_ID, DROPDOWN_ID, STYLE_ID } from './constants.js';
import { findActiveClipId, fetchClipData } from './api.js';
import type { VideoItem } from './types.js';

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Дропдаун — единая карточка VKify (ui/floating-card.ts). */
    #${DROPDOWN_ID} { min-width: 130px; z-index: 2147483647; animation: vkify-card-drop .15s ease; }
    #${BTN_ID}[disabled] { opacity: 0.5; cursor: wait; }
  `;
  document.head.appendChild(style);
}

export function closeDropdown(): void {
  document.getElementById(DROPDOWN_ID)?.remove();
}

function openDropdown(btn: HTMLButtonElement, item: VideoItem, ids: { ownerId: number; videoId: number }): void {
  closeDropdown();
  if (!item.files) return;

  const base = item.title ? sanitizeFilename(item.title) : `clip_${ids.ownerId}_${ids.videoId}`;
  const dropdown = document.createElement('div');
  dropdown.id = DROPDOWN_ID;
  dropdown.className = 'vkify-card vkify-card__list';
  if (fillQualityRows(dropdown, item.files, base, closeDropdown) === 0) return;

  // Панель справа — открываемся слева от кнопки.
  const rect = btn.getBoundingClientRect();
  dropdown.style.top   = `${Math.min(rect.top, window.innerHeight - 250)}px`;
  dropdown.style.right = `${window.innerWidth - rect.left + 8}px`;
  document.body.appendChild(dropdown);
}

export function injectControlButton(): void {
  if (document.getElementById(BTN_ID)) return;

  const controls = safeQuerySelector(SELECTORS.clip.feedControls);
  const group    = safeQuerySelector(SELECTORS.clip.roundedGroup, controls);
  const refBtn   = safeQuerySelector<HTMLButtonElement>(SELECTORS.clip.likeButton, group);
  const refInner = refBtn?.parentElement;
  if (!group || !refBtn || !refInner) return;

  injectStyle();

  // Копируем разметку соседа — наследуются все классы темы VKUI.
  const inner = document.createElement('div');
  inner.className = refInner.className;
  inner.setAttribute('style', '--rounded-spacing: 0px;');

  const btn = document.createElement('button');
  btn.id        = BTN_ID;
  btn.type      = 'button';
  btn.className = refBtn.className;
  btn.setAttribute('data-testid', 'clips-controls-vkify-download');
  btn.setAttribute('style', 'width:52px;height:52px;min-width:52px;min-height:52px;');
  attachBrandTooltip(btn, t('download.clip.btn'));

  const a11y = document.createElement('span');
  a11y.className = 'vkuiVisuallyHidden__host vkuiRootComponent__host';
  a11y.textContent = t('download.clip.btn');
  btn.appendChild(a11y);
  btn.appendChild(buildDownloadIconSvg(28));

  const ripple = document.createElement('span');
  ripple.setAttribute('aria-hidden', 'true');
  ripple.className = 'vkuiTappable__stateLayer vkuiTappable__ripple';
  btn.appendChild(ripple);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ids = findActiveClipId();
    if (!ids) return;

    btn.disabled = true;
    try {
      const data = await fetchClipData(ids.ownerId, ids.videoId);
      if (data?.files) openDropdown(btn, data, ids);
    } finally {
      btn.disabled = false;
    }
  });

  inner.appendChild(btn);

  // Вставляем перед like — учитываем что like может быть обёрнут в wrapper.
  const refWrapper = refInner.parentElement;
  const anchor = (refWrapper && refWrapper.parentElement === group) ? refWrapper : refInner;
  group.insertBefore(inner, anchor);
}

export function removeButton(): void {
  document.getElementById(BTN_ID)?.parentElement?.remove();
  document.getElementById(STYLE_ID)?.remove();
  removeBrandTooltip();
  closeDropdown();
}
