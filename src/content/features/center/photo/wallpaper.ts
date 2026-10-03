import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureHandler } from '@/types/index.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { getService, SERVICES } from '@/content/core/services/index.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { t } from '@/content/i18n/index.js';
import { isSafeBackgroundResource } from '@/shared/constants/settings-schema.js';
import { fetchPhoto, findCurrentPhotoId, getBestPhotoUrl, isVkHost } from './api.js';
import { attachBrandTooltip, hideBrandTooltip } from '../_shared/brand-tooltip.js';
import { manualWallpaperPatch } from '@/shared/wallpaper-schedule.js';

export const WALLPAPER_BTN_ID = 'vkify-photo-wallpaper-btn';
const DIVIDER_ID = `${WALLPAPER_BTN_ID}-divider`;
const STYLE_ID = `${WALLPAPER_BTN_ID}-style`;

async function imageDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Not an image');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.readAsDataURL(blob);
  });
}

/** Independent lifecycle: disabling photo downloads must leave this action intact. */
export function createPhotoWallpaperFeature(ctx: FeatureContext): FeatureHandler {
  let off: (() => void) | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  function scan(): void {
    if (!isVkHost()) return;
    const overlay = safeQuerySelector<HTMLElement>(SELECTORS.photo.viewer);
    if (!overlay || overlay.querySelector(`#${WALLPAPER_BTN_ID}`)) return;
    const actions = safeQuerySelector<HTMLElement>(SELECTORS.photo.viewerActions, overlay);
    if (!actions) return;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `#${WALLPAPER_BTN_ID} {
          font-weight: 600;
          color: var(--vkify-accent, var(--vkui--color_text_accent, #71aaeb)) !important;
          background: color-mix(in srgb, var(--vkify-accent, var(--vkui--color_text_accent, #71aaeb)) 12%, transparent);
          border-radius: 6px;
          padding: 3px 8px;
          transition: background-color .15s ease;
        }
        #${WALLPAPER_BTN_ID}:hover:not(:disabled) {
          background: color-mix(in srgb, var(--vkify-accent, var(--vkui--color_text_accent, #71aaeb)) 22%, transparent);
        }
        #${WALLPAPER_BTN_ID}:focus-visible {
          outline: 2px solid var(--vkify-accent, var(--vkui--color_text_accent, #71aaeb));
          outline-offset: 2px;
        }
        #${WALLPAPER_BTN_ID}:disabled { opacity: .6; cursor: wait; }`;
      document.head.appendChild(style);
    }

    const divider = document.createElement('span');
    divider.id = DIVIDER_ID;
    divider.className = 'divider';
    const button = document.createElement('button');
    button.id = WALLPAPER_BTN_ID;
    button.type = 'button';
    button.textContent = t('download.photo.wallpaper');
    button.setAttribute('aria-label', t('download.photo.wallpaper'));
    attachBrandTooltip(button, () => t('download.photo.wallpaper'));

    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      const ownGeneration = generation;
      if (resetTimer !== null) clearTimeout(resetTimer);
      button.disabled = true;
      button.textContent = t('download.photo.loading');
      let status = 'download.photo.wallpaper_error';
      try {
        const ids = findCurrentPhotoId();
        if (!ids) throw new Error('No photo ID');
        const photo = await fetchPhoto(ids.ownerId, ids.photoId);
        const url = getBestPhotoUrl(photo?.sizes ?? []);
        if (!url) throw new Error('No photo URL');
        const dataUrl = await imageDataUrl(url);
        if (!isSafeBackgroundResource(dataUrl)) throw new Error('Invalid image');
        if (ownGeneration !== generation) return;
        const saved = await getService(SERVICES.storage).setMultiple(manualWallpaperPatch({
          custom_background: dataUrl,
          background_type: 'image',
          background_preset_id: '',
          web_wallpaper_id: '',
          web_wallpaper_schema: '[]',
        }));
        if (!saved) throw new Error('Could not save wallpaper');
        status = 'download.photo.wallpaper_done';
      } catch (error) {
        console.warn('[VKify] Could not set photo wallpaper:', error);
      } finally {
        if (ownGeneration === generation && button.isConnected) {
          button.disabled = false;
          button.textContent = t(status);
          resetTimer = setTimeout(() => {
            button.textContent = t('download.photo.wallpaper');
            resetTimer = null;
          }, 2000);
        }
      }
    });

    const more = safeQuerySelector(SELECTORS.photo.viewerMore, actions);
    const before = more?.previousElementSibling;
    if (before?.classList.contains('divider')) {
      actions.insertBefore(divider, before);
      actions.insertBefore(button, before);
    } else {
      actions.append(divider, button);
    }
  }

  function stop(): void {
    generation++;
    off?.();
    off = null;
    if (interval !== null) clearInterval(interval);
    interval = null;
    if (resetTimer !== null) clearTimeout(resetTimer);
    resetTimer = null;
    if (document.getElementById(WALLPAPER_BTN_ID)) hideBrandTooltip();
    for (const id of [WALLPAPER_BTN_ID, DIVIDER_ID, STYLE_ID]) document.getElementById(id)?.remove();
  }

  return {
    reapplyOnNavigate: true,
    reapplyOnLanguageChange: true,
    enable: () => {
      stop();
      if (!isVkHost()) return;
      scan();
      off = ctx.observeChanges('photo_wallpaper', scan);
      interval = setInterval(scan, 800);
    },
    disable: stop,
  };
}
