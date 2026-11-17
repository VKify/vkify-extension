/**
 * Скачивание клипов VK (vk.ru / vkvideo.ru) — кнопка в правой панели
 * управления с пикером качества 1080p…240p.
 *
 * Активный клип определяется по data-clip-id карточки с data-active="true";
 * при отсутствии карточки используется URL `/clip<owner>_<id>`.
 *
 * Файл собирает фичу из модулей: api · ui.
 */

import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { isClipsPage, findActiveClipId, clearClipCache } from './api.js';
import { injectControlButton, closeDropdown, removeButton } from './ui.js';
import { DROPDOWN_ID, POLL_INTERVAL } from './constants.js';

export function createClipDownloadFeature(ctx: FeatureContext): FeatureMap {
  let off:          (() => void) | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let clickHandler: ((e: MouseEvent) => void) | null = null;
  let lastPath = '';
  let lastClip = '';

  function syncAndInject(): void {
    const active = findActiveClipId();
    const key = active ? `${active.ownerId}_${active.videoId}` : '';
    if (window.location.pathname !== lastPath || key !== lastClip) {
      lastPath = window.location.pathname;
      lastClip = key;
      closeDropdown();
    }
    injectControlButton();
  }

  function start(): void {
    lastPath = window.location.pathname;
    syncAndInject();

    // Общий observer: syncAndInject идемпотентен, observeChanges схлопывает на кадр.
    off = ctx.observeChanges('clip_download', syncAndInject);
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
      reapplyOnLanguageChange: true,
      enable: () => {
        stop();
        if (!isClipsPage()) return;
        start();
      },
      disable: () => { stop(); },
    },
  };
}
