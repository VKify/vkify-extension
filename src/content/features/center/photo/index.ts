/**
 * Скачивание фото и альбомов VK.
 *
 *  • Просмотр фото (`#pv_box`) — кнопка «Скачать» в `.pv_bottom_actions`,
 *    оригинал максимального размера через `photos.getById`.
 *  • Страница альбома (`/album<owner>_<id>`) — VKUI или классический
 *    интерфейс. Перебираем `photos.get` пачками по 1000 и упаковываем в
 *    ZIP-архив (или несколько чанков по 500 фото при больших альбомах).
 *
 * Файл собирает фичу из модулей: api · zip-album · progress-bar · buttons · styles.
 */

import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { removeBrandTooltip, ensureDownloadCenter } from '../_shared/index.js';
import { isVkHost } from './api.js';
import {
  injectPhotoViewerButton, injectAlbumPageButton, injectClassicAlbumPageButton,
} from './buttons.js';
import { PV_BTN_ID, ALBUM_BTN_ID, CLASSIC_BTN_ID, STYLE_ID } from './constants.js';

const POLL_INTERVAL = 800;

function scan(): void {
  if (!isVkHost()) return;
  injectPhotoViewerButton();
  injectAlbumPageButton();          // VKUI-страницы альбомов
  injectClassicAlbumPageButton();   // Классический #photos_all_block (группы и т.п.)
  ensureDownloadCenter();           // общий центр загрузок переживает SPA-навигацию
}

function removeAll(): void {
  document.getElementById(PV_BTN_ID)?.previousElementSibling?.remove(); // divider
  document.getElementById(PV_BTN_ID)?.remove();
  document.getElementById(ALBUM_BTN_ID)?.remove();
  document.getElementById(CLASSIC_BTN_ID)?.remove();
  document.querySelectorAll('.vkify-pb').forEach(el => el.remove());
  removeBrandTooltip();
  document.getElementById(STYLE_ID)?.remove();
}

export function createPhotoDownloadFeature(ctx: FeatureContext): FeatureMap {
  let off:          (() => void) | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function start(): void {
    scan();
    // Общий observer: scan() идемпотентен, observeChanges схлопывает вызовы на кадр.
    off = ctx.observeChanges('photo_download', scan);
    // Фолбэк для фоновой вкладки, где requestAnimationFrame не тикает.
    pollInterval = setInterval(scan, POLL_INTERVAL);
  }

  function stop(): void {
    off?.();
    off = null;
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    removeAll();
  }

  return {
    photo_download: {
      reapplyOnNavigate: true,
      enable: () => {
        stop();
        if (!isVkHost()) return;
        start();
      },
      disable: () => { stop(); },
    },
  };
}
