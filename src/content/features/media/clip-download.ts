/**
 * Скачивание клипов VK (vk.com / vkvideo.ru) — кнопка в правой панели
 * управления (`clips-feed-controls`) с пикером качества 1080p…240p.
 *
 * Активный клип определяется из URL `/clip<owner>_<id>`; фолбэк —
 * `data-snap-key` карточки с не-hidden videoContainer'ом.
 */

import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { vkApi } from '../../api/vk-api-client.js';
import {
  fillQualityRows,
  sanitizeFilename,
  buildDownloadIconSvg,
  attachBrandTooltip,
  removeBrandTooltip,
  type VideoQualityFiles,
} from './_shared.js';

const BTN_ID        = 'vkify-clip-dl-btn';
const DROPDOWN_ID   = 'vkify-clip-dl-dd';
const STYLE_ID      = 'vkify-clip-dl-style';
const POLL_INTERVAL = 600;

interface VideoItem { title?: string; files?: VideoQualityFiles }
interface VideoGetResponse { count: number; items: VideoItem[] }

function isClipsPage(): boolean {
  const host = window.location.hostname;
  if (host !== 'vk.com' && host !== 'vk.ru' && host !== 'vkvideo.ru') return false;
  return /^\/clips?(?:[-_/]|$)/.test(window.location.pathname);
}

function findActiveClipId(): { ownerId: number; videoId: number } | null {
  const m = window.location.pathname.match(/\/clip(-?\d+)_(\d+)/);
  if (m) return { ownerId: Number(m[1]), videoId: Number(m[2]) };

  for (const card of document.querySelectorAll<HTMLElement>('[data-snap-key]')) {
    const player = card.querySelector('[class*="vkitClipPlayerContainer__playerContainer"]');
    if (!player) continue;
    if (Array.from(player.classList).some(c => c.includes('playerContainerHidden'))) continue;
    const km = (card.getAttribute('data-snap-key') ?? '').match(/^(-?\d+)_(\d+)$/);
    if (km) return { ownerId: Number(km[1]), videoId: Number(km[2]) };
  }
  return null;
}

const fetchCache = new Map<string, Promise<VideoItem | null>>();

async function fetchClipData(ownerId: number, videoId: number): Promise<VideoItem | null> {
  const key = `${ownerId}_${videoId}`;
  let pending = fetchCache.get(key);
  if (pending) return pending;

  pending = (async () => {
    try {
      const resp = await vkApi.call('video.get', { videos: key, extended: 0 }) as VideoGetResponse;
      return resp?.items?.[0] ?? null;
    } catch {
      return null;
    }
  })();
  fetchCache.set(key, pending);
  const result = await pending;
  if (result === null) fetchCache.delete(key);
  return result;
}

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Дропдаун — единая карточка VKify (ui/floating-card.ts). */
    #${DROPDOWN_ID} { min-width: 130px; z-index: 2147483647; animation: vkify-card-drop .15s ease; }
    #${BTN_ID}[disabled] { opacity: 0.5; cursor: wait; }
  `;
  document.head.appendChild(style);
}

function closeDropdown(): void {
  document.getElementById(DROPDOWN_ID)?.remove();
}

function openDropdown(btn: HTMLButtonElement, item: VideoItem, ids: { ownerId: number; videoId: number }): void {
  closeDropdown();
  if (!item.files) return;

  const base = item.title ? sanitizeFilename(item.title) : `clip_${ids.ownerId}_${ids.videoId}`;
  const dropdown = document.createElement('div');
  dropdown.id = DROPDOWN_ID;
  dropdown.className = 'vkify-card vkify-card__list';
  if (fillQualityRows(dropdown, item.files, base, closeDropdown) === 0) return;

  // Панель справа — открываемся слева от кнопки.
  const rect = btn.getBoundingClientRect();
  dropdown.style.top   = `${Math.min(rect.top, window.innerHeight - 250)}px`;
  dropdown.style.right = `${window.innerWidth - rect.left + 8}px`;
  document.body.appendChild(dropdown);
}

function injectControlButton(): void {
  if (document.getElementById(BTN_ID)) return;

  const controls = document.querySelector('[data-testid="clips-feed-controls"]');
  const group    = controls?.querySelector('[data-testid="roundedgroup"]');
  const refBtn   = group?.querySelector<HTMLButtonElement>('[data-testid="clips-controls-like-button"]');
  const refInner = refBtn?.parentElement;
  if (!group || !refBtn || !refInner) return;

  injectStyle();

  // Копируем разметку соседа — наследуются все классы темы VKUI.
  const inner = document.createElement('div');
  inner.className = refInner.className;
  inner.setAttribute('style', '--rounded-spacing: 0px;');

  const btn = document.createElement('button');
  btn.id        = BTN_ID;
  btn.type      = 'button';
  btn.className = refBtn.className;
  btn.setAttribute('data-testid', 'clips-controls-vkify-download');
  btn.setAttribute('style', 'width:52px;height:52px;min-width:52px;min-height:52px;');
  attachBrandTooltip(btn, 'Скачать клип');

  const a11y = document.createElement('span');
  a11y.className = 'vkuiVisuallyHidden__host vkuiRootComponent__host';
  a11y.textContent = 'Скачать клип';
  btn.appendChild(a11y);
  btn.appendChild(buildDownloadIconSvg(28));

  const ripple = document.createElement('span');
  ripple.setAttribute('aria-hidden', 'true');
  ripple.className = 'vkuiTappable__stateLayer vkuiTappable__ripple';
  btn.appendChild(ripple);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ids = findActiveClipId();
    if (!ids) return;

    btn.disabled = true;
    try {
      const data = await fetchClipData(ids.ownerId, ids.videoId);
      if (data?.files) openDropdown(btn, data, ids);
    } finally {
      btn.disabled = false;
    }
  });

  inner.appendChild(btn);

  // Вставляем перед like — учитываем что like может быть обёрнут в wrapper.
  const refWrapper = refInner.parentElement;
  const anchor = (refWrapper && refWrapper.parentElement === group) ? refWrapper : refInner;
  group.insertBefore(inner, anchor);
}

function removeButton(): void {
  document.getElementById(BTN_ID)?.parentElement?.remove();
  document.getElementById(STYLE_ID)?.remove();
  removeBrandTooltip();
  closeDropdown();
}

export function createClipDownloadFeature(_manager: FeatureManager): FeatureMap {
  let observer:     MutationObserver | null = null;
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

    observer = new MutationObserver(syncAndInject);
    observer.observe(document.body, { childList: true, subtree: true });
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
    observer?.disconnect();
    observer = null;
    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (clickHandler) {
      document.removeEventListener('click', clickHandler);
      clickHandler = null;
    }
    fetchCache.clear();
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
