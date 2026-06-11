/**
 * Скачивание аудио VK как MP3.
 *
 * Поток:
 *   1. Инжектированный скрипт (page context) расшифровывает VK audio URL
 *      (audio_api_unavailable → реальный m3u8) через встроенный декодер
 *      или через al_audio.php API.
 *   2. Content-скрипт читает data-audio из DOM, инжектирует кнопку ⬇
 *      нативной структурой рядом с кнопками VK, при клике показывает
 *      прогресс инлайн в строке трека (без всплывающих tooltip'ов).
 *   3. После получения m3u8: загружаем через hls.js, декодируем AudioContext,
 *      кодируем в MP3 через @breezystack/lamejs.
 *   4. Опционально: дописываем ID3-теги (обложка/исполнитель/название) и
 *      текст песни из Genius — обложка и текст тянутся через background.
 *
 * Файл собирает фичу из модулей:
 *   queue · ipc · settings · meta · encoder · pipeline · dom · controls · bulk · styles
 */

import type { FeatureManager } from '../../../core/feature-manager.js';
import type { FeatureMap } from '../../../../types/index.js';
import { InjectedScript } from '../../../core/injected-scripts.js';
import {
  removeBrandTooltip, removeBrandButtonStyles, ensureDownloadCenter,
} from '../_shared.js';
import { ensureStyles } from './styles.js';
import { injectClassicButtons, injectVkuiButtons, injectPlayerButton } from './controls.js';
import { injectAlbumButton, injectAllAudiosButton } from './bulk.js';
import { resetQueue } from './queue.js';
import { trackCache } from './dom.js';
import {
  BUTTON_ATTR, STATUS_ATTR, ALBUM_ATTR, ALL_ATTR, PLAYER_ATTR, STYLES_ID,
} from './constants.js';

// ── Общий проход ────────────────────────────────────────────────────────────────

function scan(): void {
  injectClassicButtons();
  injectVkuiButtons();
  injectPlayerButton();
  injectAlbumButton();
  injectAllAudiosButton();
  // Центр загрузок переживает SPA-навигацию: ТОЛЬКО возвращаем его на body, если
  // его оторвали (без ре-рендера — иначе мутация снова дёрнет MutationObserver).
  ensureDownloadCenter();
}

// ── Экспортируемая фабрика фичи ───────────────────────────────────────────────

export function createAudioDownloadFeature(manager: FeatureManager): FeatureMap {
  let observer: MutationObserver | null = null;

  return {
    audio_download: {
      reapplyOnNavigate: true,

      enable: async () => {
        ensureStyles();
        manager.injectScript(InjectedScript.AUDIO_DOWNLOAD);

        await new Promise(r => setTimeout(r, 400));

        scan();

        observer = new MutationObserver(() => scan());
        observer.observe(document.body, { childList: true, subtree: true });
      },

      disable: () => {
        observer?.disconnect();
        observer = null;
        document.querySelectorAll(`[${BUTTON_ATTR}]`).forEach(el => el.remove());
        document.querySelectorAll(`[${STATUS_ATTR}]`).forEach(el => el.remove());
        document.querySelectorAll(`[${ALBUM_ATTR}]`).forEach(el => el.remove());
        document.querySelectorAll(`[${ALL_ATTR}]`).forEach(el => el.remove());
        document.querySelectorAll(`[${PLAYER_ATTR}]`).forEach(el => el.remove());
        // Центр загрузок общий для всех фич — не удаляем его при выключении только
        // аудио (он сам прячется, когда пустой, и переживает SPA-навигацию).
        removeBrandTooltip();
        removeBrandButtonStyles();
        document.getElementById(STYLES_ID)?.remove();
        trackCache.clear();
        resetQueue();
      },
    },
  };
}
