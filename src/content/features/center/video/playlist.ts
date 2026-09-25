/** Массовое скачивание плейлиста VK Video. */

import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { t } from '@/content/i18n/index.js';
import { ensureCardStyles } from '@/content/ui/floating-card.js';
import {
  QUALITY_COLORS,
  createBrandButton,
  setBrandButtonLabel,
  sanitizeFilename,
  requestDownload,
  VIDEO_QUALITIES,
  type VideoQualityFiles,
  type VideoQualityKey,
} from '../_shared/index.js';
import { fetchPlaylistVideos, parsePlaylistIds } from './api.js';
import { PLAYLIST_ATTR, PLAYLIST_MENU_ATTR } from './constants.js';
import type { VideoItem } from './types.js';

function playlistTitle(): string {
  const panel = safeQuerySelector(SELECTORS.video.playlistPanel);
  const link = panel?.querySelector<HTMLAnchorElement>('a[href*="/playlist/"]');
  const ids = parsePlaylistIds(window.location);
  return sanitizeFilename(
    link?.textContent?.trim() || (ids ? `playlist-${ids.ownerId}_${ids.albumId}` : 'playlist'),
  );
}

/** Выбирает запрошенное качество либо ближайшее доступное ниже него. */
export function selectPlaylistFile(
  files: VideoQualityFiles,
  requested: VideoQualityKey,
): { url: string; label: string } | null {
  const start = VIDEO_QUALITIES.findIndex(q => q.key === requested);
  const ordered = [...VIDEO_QUALITIES.slice(start), ...VIDEO_QUALITIES.slice(0, start).reverse()];
  for (const quality of ordered) {
    const url = files[quality.key];
    if (url) return { url, label: quality.label };
  }
  return null;
}

export function availablePlaylistQualities(items: VideoItem[]): typeof VIDEO_QUALITIES[number][] {
  return VIDEO_QUALITIES.filter(q => items.some(item => Boolean(item.files?.[q.key])));
}

function setBusy(button: HTMLElement, busy: boolean): void {
  if (busy) button.setAttribute('data-busy', '1');
  else button.removeAttribute('data-busy');
}

function queuePlaylist(items: VideoItem[], quality: typeof VIDEO_QUALITIES[number], button: HTMLElement): void {
  if (!window.confirm(t('download.video.playlist_confirm', { count: items.length, quality: quality.label }))) return;
  const folder = playlistTitle();
  const pad = String(items.length).length;
  let added = 0;
  items.forEach((item, index) => {
    const file = selectPlaylistFile(item.files ?? {}, quality.key);
    if (!file) return;
    const title = sanitizeFilename(item.title || `video-${index + 1}`);
    const number = String(index + 1).padStart(pad, '0');
    requestDownload(file.url, `${folder}/${number}. ${title}_${file.label}.mp4`);
    added++;
  });
  setBrandButtonLabel(button, t('download.video.playlist_started', { count: added }));
  window.setTimeout(() => setBrandButtonLabel(button, t('download.video.playlist_btn')), 3500);
}

function renderQualityMenu(menu: HTMLElement, items: VideoItem[], button: HTMLElement): void {
  menu.replaceChildren();
  for (const quality of availablePlaylistQualities(items)) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'vkify-card__item';
    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '8px', height: '8px', borderRadius: '50%', flexShrink: '0',
      background: QUALITY_COLORS[quality.key],
    });
    const label = document.createElement('span');
    label.className = 'vkify-card__title';
    label.textContent = quality.label;
    row.append(dot, label);
    row.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      menu.style.display = 'none';
      queuePlaylist(items, quality, button);
    });
    menu.appendChild(row);
  }
}

/** Меню живёт прямо в body: так overflow/transform карточки VK не обрезает его. */
function showQualityMenu(menu: HTMLElement, button: HTMLElement): void {
  const rect = button.getBoundingClientRect();
  const openAbove = rect.top >= 190;
  Object.assign(menu.style, {
    display: 'flex',
    position: 'fixed',
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(120, rect.width) - 8))}px`,
    top: openAbove ? 'auto' : `${rect.bottom + 8}px`,
    bottom: openAbove ? `${window.innerHeight - rect.top + 8}px` : 'auto',
    minWidth: `${Math.max(120, rect.width)}px`,
  });
}

async function togglePlaylistMenu(button: HTMLElement, menu: HTMLElement): Promise<void> {
  if (menu.childElementCount > 0) {
    if (menu.style.display === 'none') showQualityMenu(menu, button);
    else menu.style.display = 'none';
    return;
  }
  const ids = parsePlaylistIds(window.location);
  if (!ids || button.getAttribute('data-busy') === '1') return;
  setBusy(button, true);
  setBrandButtonLabel(button, t('download.video.playlist_loading'));
  try {
    const items = await fetchPlaylistVideos(ids.ownerId, ids.albumId);
    if (!items.length || !availablePlaylistQualities(items).length) {
      setBrandButtonLabel(button, t('download.video.playlist_empty'));
      return;
    }
    renderQualityMenu(menu, items, button);
    showQualityMenu(menu, button);
    setBrandButtonLabel(button, t('download.video.playlist_btn'));
  } catch {
    setBrandButtonLabel(button, t('download.video.playlist_failed'));
    window.setTimeout(() => setBrandButtonLabel(button, t('download.video.playlist_btn')), 3500);
  } finally {
    setBusy(button, false);
  }
}

/** Вставляет кнопку по стабильным testid-якорям обеих страниц плейлиста. */
export function injectPlaylistButton(): void {
  const ids = parsePlaylistIds(window.location);
  const existing = document.querySelector<HTMLElement>(`[${PLAYLIST_ATTR}]`);
  if (!ids) { existing?.remove(); return; }
  if (existing?.isConnected) return;

  const sidePanel = safeQuerySelector<HTMLElement>(SELECTORS.video.playlistPanel);
  const copyButton = safeQuerySelector<HTMLElement>(SELECTORS.video.playlistCopyButton, sidePanel);
  const subscribeButton = safeQuerySelector<HTMLElement>(SELECTORS.video.playlistSubscribeButton);
  const playButton = safeQuerySelector<HTMLElement>(SELECTORS.video.playlistPlayButton);
  const playlistActions = playButton?.parentElement;
  const row = (copyButton ?? subscribeButton)?.parentElement ?? playlistActions;
  if (!row) return;

  ensureCardStyles();
  const control = document.createElement('div');
  control.setAttribute(PLAYLIST_ATTR, '');
  control.style.position = 'relative';
  const menu = document.createElement('div');
  menu.setAttribute(PLAYLIST_MENU_ATTR, '');
  menu.className = 'vkify-card vkify-card__list';
  Object.assign(menu.style, {
    display: 'none', zIndex: '2147483647', maxHeight: 'min(320px, 60vh)', overflowY: 'auto',
  });
  const button = createBrandButton(t('download.video.playlist_btn'), t('download.video.playlist_tooltip'));
  Object.assign(button.style, { height: '32px', padding: '0 12px', boxShadow: 'none' });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void togglePlaylistMenu(button, menu);
  });
  control.append(button);
  document.body.appendChild(menu);
  if (copyButton) {
    row.insertBefore(control, copyButton);
  } else if (subscribeButton) {
    // На /playlist/… нативная кнопка подписки занимает всю ширину вертикальной
    // группы. Повторяем её геометрию и ставим VKify-кнопку сразу под ней.
    Object.assign(control.style, { width: '100%', alignSelf: 'stretch' });
    Object.assign(button.style, { width: '100%', justifyContent: 'center' });
    subscribeButton.insertAdjacentElement('afterend', control);
  } else if (playlistActions) {
    // Fallback для варианта страницы без кнопки подписки: testid основной
    // кнопки воспроизведения остаётся надёжным якорем горизонтального ряда.
    Object.assign(control.style, { width: '100%', alignSelf: 'stretch' });
    Object.assign(button.style, { width: '100%', justifyContent: 'center' });
    playlistActions.insertAdjacentElement('afterend', control);
  }
}

export function removePlaylistButton(): void {
  document.querySelectorAll(`[${PLAYLIST_ATTR}], [${PLAYLIST_MENU_ATTR}]`).forEach(el => el.remove());
}
