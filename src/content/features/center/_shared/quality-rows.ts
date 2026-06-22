/** Строки выбора качества «● 1080p» для дропдаунов видео/клипов/сторис. */

import { ensureCardStyles } from '@/content/ui/floating-card.js';
import { QUALITY_COLORS, VIDEO_QUALITIES, type VideoQualityFiles } from './quality.js';
import { requestDownload } from './download-request.js';

/**
 * Наполняет контейнер строками «● 1080p» для каждого доступного качества.
 * Каждая строка по клику закрывает контейнер (через `onSelect`) и стартует
 * скачивание выбранного URL'а. Возвращает количество добавленных строк.
 *
 * Контейнеру дропдауна фича назначает классы `vkify-card vkify-card__list`
 * (единый компонент карточки, см. ui/floating-card.ts) — позиционирование
 * и ширина остаются на стороне фичи.
 */
export function fillQualityRows(
  container: HTMLElement,
  files: VideoQualityFiles,
  baseFilename: string,
  onSelect: () => void,
): number {
  ensureCardStyles();
  let count = 0;
  for (const q of VIDEO_QUALITIES) {
    const url = files[q.key];
    if (!url) continue;
    count++;

    const row = document.createElement('div');
    row.className = 'vkify-card__item';
    row.setAttribute('role', 'button');
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect();
      requestDownload(url, `${baseFilename}_${q.label}.mp4`);
    });

    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width:        '8px',
      height:       '8px',
      borderRadius: '50%',
      background:   QUALITY_COLORS[q.key] ?? '#9ca3af',
      flexShrink:   '0',
      display:      'inline-block',
    });
    const lbl = document.createElement('span');
    lbl.className = 'vkify-card__title';
    lbl.textContent = q.label;

    row.appendChild(dot);
    row.appendChild(lbl);
    container.appendChild(row);
  }
  return count;
}
