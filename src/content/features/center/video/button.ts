/** Кнопка «Скачать» с пикером качества: в ряду действий или FAB-фолбэк. */

import {
  fillQualityRows,
  sanitizeFilename,
  buildVkifyLogo,
  type VideoQualityFiles,
} from '../_shared/index.js';
import { CONTAINER_ATTR, CONTAINER_ID, STYLE_ID } from './constants.js';
import { getService, SERVICES } from '@/content/core/services/index.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { t } from '@/content/i18n/index.js';

function applyVkifyButtonStyles(button: HTMLButtonElement, background: string): void {
  Object.assign(button.style, {
    display:        'flex',
    alignItems:     'center',
    gap:            '7px',
    background,
    color:          '#fff',
    border:         'none',
    padding:        '10px 18px 10px 14px',
    borderRadius:   '12px',
    cursor:         'pointer',
    fontSize:       '13px',
    fontWeight:     '700',
    letterSpacing:  '0.01em',
    whiteSpace:     'nowrap',
    transition:     'transform 0.15s, box-shadow 0.15s',
    outline:        'none',
    userSelect:     'none',
  });
}

function applyFallbackPosition(root: HTMLElement): void {
  Object.assign(root.style, {
    position:   'fixed',
    bottom:     '24px',
    right:      '24px',
    marginLeft: '',
    marginRight: '',
    flexShrink: '',
  });
}

/**
 * Переносит уже созданную кнопку в ряд действий перед «Ещё». Если новый ряд
 * ещё не смонтирован, сохраняет прежнее положение FAB.
 */
export function placeButtonInVideoActions(): boolean {
  const root = document.getElementById(CONTAINER_ID) as HTMLElement | null;
  if (!root) return false;

  const moreButton = safeQuerySelector<HTMLElement>(SELECTORS.video.moreButton);
  let row = moreButton?.parentElement ?? null;

  // Like/share помогают найти актуальный ряд при промежуточной SPA-разметке,
  // но вставка всё равно выполняется только перед кнопкой «Ещё» этого ряда.
  if (!row) {
    const rowAnchor = safeQuerySelector<HTMLElement>([
      ...SELECTORS.video.likeButton,
      ...SELECTORS.video.shareButton,
    ]);
    row = rowAnchor?.parentElement ?? null;
  }
  const rowMoreButton = safeQuerySelector<HTMLElement>(SELECTORS.video.moreButton, row);

  if (!row || !rowMoreButton) {
    if (root.parentElement !== document.body) document.body.appendChild(root);
    applyFallbackPosition(root);
    return false;
  }

  const existing = row.querySelector<HTMLElement>(
    `[${CONTAINER_ATTR}], #${CONTAINER_ID}`,
  );
  if (existing && existing !== root) return true;

  Object.assign(root.style, {
    position:   'relative',
    bottom:     '',
    right:      '',
    marginLeft: '8px',
    marginRight: '8px',
    flexShrink: '0',
  });
  if (root.parentElement !== row || root.nextElementSibling !== rowMoreButton) {
    row.insertBefore(root, rowMoreButton);
  }
  return true;
}

export function removeUI(): void {
  document.querySelectorAll(`[${CONTAINER_ATTR}], #${CONTAINER_ID}`).forEach(el => el.remove());
  document.getElementById(STYLE_ID)?.remove();
}

export function injectButton(
  files: VideoQualityFiles,
  title: string,
  setAsWallpaper?: (url: string) => Promise<void>,
): void {
  removeUI();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes vkify-pulse {
      0%   { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 0 rgba(33,150,255,0.4); }
      70%  { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 10px rgba(33,150,255,0); }
      100% { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 0 rgba(33,150,255,0); }
    }
    #${CONTAINER_ID} button { animation: vkify-pulse 2.2s ease-out infinite; }
    #${CONTAINER_ID} button:hover {
      animation: none !important;
      box-shadow: 0 6px 28px rgba(33,150,255,0.7) !important;
      transform: scale(1.04) !important;
    }
    /* Дропдаун — единая карточка VKify (ui/floating-card.ts), открывается вверх. */
    #${CONTAINER_ID} .__vkify-dd { animation: vkify-card-in 0.15s ease; }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = CONTAINER_ID;
  root.setAttribute(CONTAINER_ATTR, '');
  Object.assign(root.style, {
    position:   'fixed',
    bottom:     '24px',
    right:      '24px',
    zIndex:     '2147483647',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display:    'flex',
    alignItems: 'center',
    gap:        '8px',
  });

  const dropdown = document.createElement('div');
  dropdown.className = 'vkify-card vkify-card__list __vkify-dd';
  Object.assign(dropdown.style, {
    display:  'none',
    position: 'absolute',
    bottom:   'calc(100% + 10px)',
    right:    '0',
    minWidth: '130px',
  });

  // Dropdown должен оставаться привязанным именно к кнопке скачивания, а не к
  // общей flex-обёртке с соседней кнопкой «Сделать обоями».
  const downloadControl = document.createElement('div');
  downloadControl.style.position = 'relative';

  let open = false;
  const hideDropdown = (): void => {
    if (!open) return;
    open = false;
    dropdown.style.display = 'none';
    chevron.textContent = '▾';
  };

  if (fillQualityRows(dropdown, files, sanitizeFilename(title), hideDropdown) === 0) {
    style.remove();
    return;
  }

  const btn = document.createElement('button');
  applyVkifyButtonStyles(btn, 'linear-gradient(135deg, #2196ff 0%, #0050cc 100%)');

  const btnLabel = document.createElement('span');
  btnLabel.textContent = t('download.video.btn');

  const chevron = document.createElement('span');
  chevron.textContent = '▾';
  Object.assign(chevron.style, { fontSize: '11px', opacity: '0.75', marginLeft: '1px' });

  btn.appendChild(buildVkifyLogo());
  btn.appendChild(btnLabel);
  btn.appendChild(chevron);

  const wallpaperUrl = files.mp4_1080 ?? files.mp4_720 ?? files.mp4_480
    ?? files.mp4_360 ?? files.mp4_240;
  let wallpaperBtn: HTMLButtonElement | null = null;
  if (wallpaperUrl && setAsWallpaper) {
    wallpaperBtn = document.createElement('button');
    applyVkifyButtonStyles(
      wallpaperBtn,
      'linear-gradient(135deg, #9b6cff 0%, #6334d8 100%)',
    );
    const wallpaperLabel = document.createElement('span');
    wallpaperLabel.textContent = t('download.video.wallpaper');
    wallpaperBtn.appendChild(buildVkifyLogo());
    wallpaperBtn.appendChild(wallpaperLabel);
    wallpaperBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!wallpaperBtn) return;
      wallpaperBtn.disabled = true;
      void setAsWallpaper(wallpaperUrl).then(() => {
        wallpaperLabel.textContent = t('download.video.wallpaper_done');
        window.setTimeout(() => {
          wallpaperLabel.textContent = t('download.video.wallpaper');
        }, 1800);
      }).catch(() => {
        wallpaperLabel.textContent = t('download.video.wallpaper_error');
      }).finally(() => {
        if (wallpaperBtn) wallpaperBtn.disabled = false;
      });
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    open = !open;
    if (open) {
      // Перезапуск fadein-анимации.
      dropdown.style.display = 'none';
      dropdown.classList.remove('__vkify-dd');
      void dropdown.offsetWidth;
      dropdown.classList.add('__vkify-dd');
      dropdown.style.display = 'flex';
      chevron.textContent = '▴';
    } else {
      dropdown.style.display = 'none';
      chevron.textContent = '▾';
    }
  });

  document.addEventListener('click', hideDropdown);

  // Снимаем глобальный слушатель, когда кнопку удалят из DOM.
  getService(SERVICES.domObserver).whenRemoved(root, () => document.removeEventListener('click', hideDropdown));

  downloadControl.appendChild(dropdown);
  downloadControl.appendChild(btn);
  root.appendChild(downloadControl);
  if (wallpaperBtn) root.appendChild(wallpaperBtn);
  document.body.appendChild(root);
  placeButtonInVideoActions();
}
