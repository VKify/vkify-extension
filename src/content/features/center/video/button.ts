/** Плавающая кнопка «Скачать» с пикером качества (правый нижний угол). */

import {
  fillQualityRows,
  sanitizeFilename,
  buildVkifyLogo,
  type VideoQualityFiles,
} from '../_shared.js';
import { CONTAINER_ID, STYLE_ID } from './constants.js';

export function removeUI(): void {
  document.getElementById(CONTAINER_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

export function injectButton(files: VideoQualityFiles, title: string): void {
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
  Object.assign(root.style, {
    position:   'fixed',
    bottom:     '24px',
    right:      '24px',
    zIndex:     '2147483647',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
  Object.assign(btn.style, {
    display:        'flex',
    alignItems:     'center',
    gap:            '7px',
    background:     'linear-gradient(135deg, #2196ff 0%, #0050cc 100%)',
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

  const btnLabel = document.createElement('span');
  btnLabel.textContent = 'Скачать';

  const chevron = document.createElement('span');
  chevron.textContent = '▾';
  Object.assign(chevron.style, { fontSize: '11px', opacity: '0.75', marginLeft: '1px' });

  btn.appendChild(buildVkifyLogo());
  btn.appendChild(btnLabel);
  btn.appendChild(chevron);

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

  // Снимаем глобальный слушатель когда кнопка удалена.
  const observer = new MutationObserver(() => {
    if (!document.contains(root)) {
      document.removeEventListener('click', hideDropdown);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });

  root.appendChild(dropdown);
  root.appendChild(btn);
  document.body.appendChild(root);
}
