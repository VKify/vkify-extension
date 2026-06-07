/**
 * Скачивание видео с vkvideo.ru — плавающая кнопка «Скачать» с пикером
 * качества 1080p…240p. Прямые ссылки берутся через `video.get`.
 */

import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { vkApi } from '../../api/vk-api-client.js';
import {
  fillQualityRows,
  sanitizeFilename,
  buildVkifyLogo,
  type VideoQualityFiles,
} from './_shared.js';

const CONTAINER_ID = 'vkify-video-dl';
const STYLE_ID     = 'vkify-video-dl-style';

interface VideoItem { title?: string; files?: VideoQualityFiles }
interface VideoGetResponse { count: number; items: VideoItem[] }

function parseVideoIds(pathname: string): { ownerId: number; videoId: number } | null {
  const m = pathname.match(/\/video(-?\d+)_(\d+)/);
  if (!m) return null;
  return { ownerId: Number(m[1]), videoId: Number(m[2]) };
}

function removeUI(): void {
  document.getElementById(CONTAINER_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

async function fetchVideoData(
  ownerId: number,
  videoId: number,
): Promise<{ files: VideoQualityFiles; title: string } | null> {
  try {
    const resp = await vkApi.call('video.get', {
      videos:   `${ownerId}_${videoId}`,
      extended: 0,
    }) as VideoGetResponse;
    const item = resp?.items?.[0];
    if (!item) return null;
    return { files: item.files ?? {}, title: item.title ?? 'video' };
  } catch {
    return null;
  }
}

function injectButton(files: VideoQualityFiles, title: string): void {
  removeUI();

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes vkify-pulse {
      0%   { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 0 rgba(33,150,255,0.4); }
      70%  { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 10px rgba(33,150,255,0); }
      100% { box-shadow: 0 4px 20px rgba(33,150,255,0.55), 0 0 0 0 rgba(33,150,255,0); }
    }
    @keyframes vkify-fadein {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    #${CONTAINER_ID} button { animation: vkify-pulse 2.2s ease-out infinite; }
    #${CONTAINER_ID} button:hover {
      animation: none !important;
      box-shadow: 0 6px 28px rgba(33,150,255,0.7) !important;
      transform: scale(1.04) !important;
    }
    #${CONTAINER_ID} .__vkify-dd { animation: vkify-fadein 0.15s ease; }
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
  dropdown.className = '__vkify-dd';
  Object.assign(dropdown.style, {
    display:      'none',
    position:     'absolute',
    bottom:       'calc(100% + 10px)',
    right:        '0',
    background:   '#fff',
    border:       '1px solid rgba(0,0,0,0.07)',
    borderRadius: '14px',
    boxShadow:    '0 12px 32px rgba(0,0,0,0.18)',
    overflow:     'hidden',
    minWidth:     '130px',
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
      dropdown.className = '';
      void dropdown.offsetWidth;
      dropdown.className = '__vkify-dd';
      dropdown.style.display = 'block';
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

export function createVideoDownloadFeature(_manager: FeatureManager): FeatureMap {
  return {
    video_download: {
      reapplyOnNavigate: true,

      enable: async () => {
        if (window.location.hostname !== 'vkvideo.ru') { removeUI(); return; }
        const ids = parseVideoIds(window.location.pathname);
        if (!ids) { removeUI(); return; }

        const startPath = window.location.pathname;
        let data = await fetchVideoData(ids.ownerId, ids.videoId);

        // Retry — токен может быть не готов при холодном открытии страницы.
        if (!data) {
          await new Promise<void>(r => setTimeout(r, 3000));
          if (window.location.pathname !== startPath) return;
          data = await fetchVideoData(ids.ownerId, ids.videoId);
        }

        if (window.location.pathname !== startPath) return;
        if (data) injectButton(data.files, data.title);
      },

      disable: () => { removeUI(); },
    },
  };
}
