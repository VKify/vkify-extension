/**
 * Скачивание клипов VK (vk.com / vkvideo.ru) — кнопка в правой панели
 * управления (`clips-feed-controls`) с пикером качества 1080p…240p.
 *
 * Активный клип определяется из URL `/clip<owner>_<id>`; фолбэк —
 * `data-snap-key` карточки с не-hidden videoContainer'ом.
 *
 * Файл собирает фичу из модулей: api · ui.
 */

import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';
import { isClipsPage, clearClipCache } from './api.js';
import { injectControlButton, closeDropdown, removeButton } from './ui.js';
import { DROPDOWN_ID, POLL_INTERVAL } from './constants.js';

export function createClipDownloadFeature(manager: FeatureManager): FeatureMap {
  let off:          (() => void) | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let clickHandler: ((e: MouseEvent) => void) | null = null;
  let lastPath = '';

  function syncAndInject(): void {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      closeDropdown();
    }
    injectControlButton();
  }

  function start(): void {
    lastPath = window.location.pathname;
    injectControlButton();

    // Общий observer: syncAndInject идемпотентен, observeChanges схлопывает на кадр.
    off = manager.observeChanges('clip_download', syncAndInject);
    // Фолбэк для фоновой вкладки, где requestAnimationFrame не тикает.
    pollInterval = setInterval(syncAndInject, POLL_INTERVAL);

    clickHandler = (e: MouseEvent) => {
      const dd = document.getElementById(DROPDOWN_ID);
      if (!dd) return;
      if (e.target instanceof Node && dd.contains(e.target)) return;
      closeDropdown();
    };
    document.addEventListener('click', clickHandler);
  }

  function stop(): void {
    off?.();
    off = null;
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
      clickHandler = null;
    }
    clearClipCache();
    removeButton();
  }

  return {
    clip_download: {
      reapplyOnNavigate: true,
      enable: () => {
        stop();
        if (!isClipsPage()) return;
        start();
      },
      disable: () => { stop(); },
    },
  };
}
