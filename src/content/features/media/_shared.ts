/**
 * Общие утилиты и константы для всех download-фич:
 *   • video-download   — обычные видео (vkvideo.ru)
 *   • story-download   — сторис (vk.com)
 *   • clip-download    — клипы (vk.com / vkvideo.ru)
 *   • photo-download   — фото и альбомы (vk.com)
 */

/** Цвет «точки» у каждого качества в пикере. */
export const QUALITY_COLORS: Record<string, string> = {
  mp4_1080: '#a855f7',
  mp4_720:  '#3b82f6',
  mp4_480:  '#06b6d4',
  mp4_360:  '#10b981',
  mp4_240:  '#9ca3af',
};

/** Порядок отображения качеств в пикере (от высшего к низшему). */
export const VIDEO_QUALITIES = [
  { key: 'mp4_1080' as const, label: '1080p' },
  { key: 'mp4_720'  as const, label: '720p'  },
  { key: 'mp4_480'  as const, label: '480p'  },
  { key: 'mp4_360'  as const, label: '360p'  },
  { key: 'mp4_240'  as const, label: '240p'  },
];

export type VideoQualityKey = typeof VIDEO_QUALITIES[number]['key'];

/** Поля прямых URL'ов из ответа video.get / stories.getById. */
export interface VideoQualityFiles {
  mp4_1080?: string;
  mp4_720?:  string;
  mp4_480?:  string;
  mp4_360?:  string;
  mp4_240?:  string;
}

/** Запрещённые в именах файлов символы → подчёркивание; длина ≤ 180. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 180);
}

/** Отправляет запрос на скачивание в background (chrome.downloads). */
export function requestDownload(url: string, filename: string): void {
  void chrome.runtime.sendMessage({ type: 'DOWNLOAD_VIDEO', url, filename });
}

/** Material-style стрелка вниз 24×24. */
export function buildDownloadIconSvg(size = 24): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.style.cssText = `width:${size}px;height:${size}px;display:block`;
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z');
  svg.appendChild(p);
  return svg;
}

/**
 * Наполняет контейнер строками «● 1080p» для каждого доступного качества.
 * Каждая строка по клику закрывает контейнер (через `onSelect`) и стартует
 * скачивание выбранного URL'а. Возвращает количество добавленных строк.
 */
export function fillQualityRows(
  container: HTMLElement,
  files: VideoQualityFiles,
  baseFilename: string,
  onSelect: () => void,
): number {
  let count = 0;
  for (const q of VIDEO_QUALITIES) {
    const url = files[q.key];
    if (!url) continue;
    count++;

    const row = document.createElement('div');
    Object.assign(row.style, {
      display:    'flex',
      alignItems: 'center',
      gap:        '10px',
      padding:    '9px 14px',
      fontSize:   '13px',
      fontWeight: '500',
      color:      '#1a1a1a',
      cursor:     'pointer',
      transition: 'background 0.1s',
      whiteSpace: 'nowrap',
    });
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(33,150,255,0.07)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
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
    lbl.textContent = q.label;

    row.appendChild(dot);
    row.appendChild(lbl);
    container.appendChild(row);
  }
  return count;
}

/** Базовая разметка/стили дропдауна качества (без позиционирования). */
export const QUALITY_DROPDOWN_CSS = `
  position: fixed;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  overflow: hidden;
  min-width: 120px;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;
