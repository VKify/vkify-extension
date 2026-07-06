/**
 * Инжекция кнопок скачивания: в photoviewer (`#pv_box`), на VKUI-странице
 * альбома и на классической `#photos_all_block`. Общий handler альбома —
 * confirm → прогресс-бар → ZIP.
 *
 * Migrated to new DOM layer: все VK-якоря вынесены в SELECTORS.photo / .common
 * и читаются через safeQuerySelector.
 */

import {
  requestDownload, buildDownloadIconSvg, attachBrandTooltip,
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError,
} from '../_shared/index.js';
import { safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { t } from '@/content/i18n/index.js';
import { injectStyle } from './styles.js';
import { createProgressBar } from './progress-bar.js';
import { parseAlbumPath, findCurrentPhotoId, getBestPhotoUrl, fetchPhoto } from './api.js';
import { downloadAlbumAll } from './zip-album.js';
import { PV_BTN_ID, ALBUM_BTN_ID, CLASSIC_BTN_ID } from './constants.js';

// ── Кнопка в photoviewer (`#pv_box`) ───────────────────────────────────────

export function injectPhotoViewerButton(): void {
  const overlay = safeQuerySelector<HTMLElement>(SELECTORS.photo.viewer);
  if (!overlay || overlay.querySelector(`#${PV_BTN_ID}`)) return;
  const actions = safeQuerySelector<HTMLElement>(SELECTORS.photo.viewerActions, overlay);
  if (!actions) return;

  injectStyle();

  const divider = document.createElement('span');
  divider.className = 'divider';

  const btn = document.createElement('button');
  btn.id          = PV_BTN_ID;
  btn.type        = 'button';
  btn.setAttribute('aria-label', t('download.photo.aria'));
  btn.textContent = t('download.photo.btn');
  attachBrandTooltip(btn, t('download.photo.aria'));

  const flash = (msg: string): void => {
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = t('download.photo.btn'); }, 1500);
  };

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const ids = findCurrentPhotoId();
    if (!ids) { flash(t('download.photo.no_id')); return; }

    btn.disabled = true;
    btn.textContent = t('download.photo.loading');
    try {
      const photo = await fetchPhoto(ids.ownerId, ids.photoId);
      if (!photo) { flash(t('download.photo.api_error')); return; }
      if (!photo.sizes?.length) { flash(t('download.photo.no_sizes')); return; }
      const url = getBestPhotoUrl(photo.sizes);
      if (!url) { flash(t('download.photo.no_url')); return; }
      requestDownload(url, `photo_${ids.ownerId}_${ids.photoId}.jpg`);
      flash(t('download.photo.done'));
    } finally {
      btn.disabled = false;
    }
  });

  // Между «Удалить» и «Ещё», после собственного divider.
  const moreBtn = safeQuerySelector(SELECTORS.photo.viewerMore, actions);
  const prev    = moreBtn?.previousElementSibling;
  if (prev?.classList.contains('divider')) {
    actions.insertBefore(divider, prev);
    actions.insertBefore(btn, prev);
  } else {
    actions.appendChild(divider);
    actions.appendChild(btn);
  }
}

// ── Кнопка скачивания альбома (общая логика handler'а) ────────────────────

/**
 * Прикрепляет к элементу-триггеру универсальный handler: confirm → прогресс-бар →
 * скачивание ZIP'а → восстановление состояния. Через колбэки управляет
 * визуальным состоянием (disable/title) самого триггера — он может быть и
 * `<button>`, и `<a>`.
 */
function attachAlbumDownloadHandler(
  trigger: HTMLElement,
  ids: { ownerId: number; albumId: string },
  ctl: {
    initialTitle: string;
    setBusy:    (busy: boolean) => void;
    setStatus:  (text: string) => void;
  },
): void {
  trigger.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t('download.album.confirm'))) return;

    ctl.setBusy(true);
    ctl.setStatus(t('download.album.preparing'));
    const pb = createProgressBar();
    trigger.insertAdjacentElement('afterend', pb.el);

    const jobId = `album-photos:${ids.ownerId}_${ids.albumId}`;
    const ctrl = new AbortController();
    downloadCenterJobStart(jobId, t('download.album.job_title'), () => {
      ctrl.abort();
      downloadCenterJobUpdate(jobId, t('download.album.stopping'));
    });

    try {
      const res = await downloadAlbumAll(ids.ownerId, ids.albumId, (done, total) => {
        ctl.setStatus(t('download.album.downloaded', { done, total }));
        downloadCenterJobUpdate(jobId, t('download.album.downloaded', { done, total }), done, total);
        pb.set(done, total);
      }, ctrl.signal);
      const tail = res.failed > 0 ? t('download.album.failed_suffix', { count: res.failed }) : '';
      const head = res.cancelled
        ? t('download.album.cancelled', { ok: res.ok, total: res.total })
        : t('download.album.done', { ok: res.ok, total: res.total });
      ctl.setStatus(`${head}${tail} ✓`);
      downloadCenterJobDone(jobId, `${head}${tail}`);
      pb.finish(res.ok, res.total, res.failed);
      setTimeout(() => { ctl.setStatus(ctl.initialTitle); pb.remove(); }, 4000);
    } catch {
      ctl.setStatus(t('download.common.error'));
      downloadCenterJobError(jobId, t('download.common.error'));
      pb.error();
      setTimeout(() => { ctl.setStatus(ctl.initialTitle); pb.remove(); }, 2500);
    } finally {
      ctl.setBusy(false);
    }
  });
}

/** VKUI-страницы альбомов (`[data-testid="headerlayout-aside"]`). */
export function injectAlbumPageButton(): void {
  const ids = parseAlbumPath(window.location.pathname);
  if (!ids || document.getElementById(ALBUM_BTN_ID)) return;

  const aside = safeQuerySelector<HTMLElement>(SELECTORS.common.headerAsideGroup);
  const refBtn = aside?.querySelector<HTMLButtonElement>('button');
  if (!aside || !refBtn) return;

  injectStyle();

  // Делаем icon-only по образцу «···» — `vkuiButton__singleIcon` уже в className.
  const btn = document.createElement('button');
  btn.id        = ALBUM_BTN_ID;
  btn.type      = 'button';
  btn.className = refBtn.className;
  btn.setAttribute('aria-label', t('download.album.btn'));
  attachBrandTooltip(btn, t('download.album.tooltip'));

  const inner = document.createElement('span');
  inner.className = 'vkuiButton__in';
  const before = document.createElement('span');
  before.className = 'vkuiButton__before';
  before.setAttribute('role', 'presentation');
  before.appendChild(buildDownloadIconSvg(20));
  inner.appendChild(before);
  btn.appendChild(inner);

  attachAlbumDownloadHandler(btn, ids, {
    initialTitle: t('download.album.btn'),
    setBusy:   (b) => { btn.disabled = b; },
    setStatus: (text) => { btn.setAttribute('aria-label', text); },
  });

  aside.insertBefore(btn, aside.firstElementChild);
}

/** Классические страницы `#photos_all_block` — нет headerlayout-aside. */
export function injectClassicAlbumPageButton(): void {
  const ids = parseAlbumPath(window.location.pathname);
  if (!ids || document.getElementById(CLASSIC_BTN_ID)) return;

  const block = safeQuerySelector<HTMLElement>(SELECTORS.photo.classicAlbumBlock);
  const extra = safeQuerySelector<HTMLElement>(SELECTORS.photo.classicHeaderExtra, block);
  if (!extra) return;

  injectStyle();

  // Класс `photos_album_reverse_btn` наследует hover/цвет от соседней reverse-кнопки.
  const a = document.createElement('a');
  a.id        = CLASSIC_BTN_ID;
  a.href      = '#';
  a.className = 'photos_album_reverse_btn';
  a.setAttribute('role', 'button');
  a.setAttribute('aria-label', t('download.album.btn'));
  attachBrandTooltip(a, t('download.album.tooltip'));
  Object.assign(a.style, { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginRight: '4px' });
  a.appendChild(buildDownloadIconSvg(24));

  attachAlbumDownloadHandler(a, ids, {
    initialTitle: t('download.album.btn'),
    setBusy:   (b) => {
      a.style.pointerEvents = b ? 'none' : '';
      a.style.opacity       = b ? '0.5'  : '';
    },
    setStatus: (text) => { a.setAttribute('aria-label', text); },
  });

  const reverseBtn = safeQuerySelector(SELECTORS.photo.classicReverseBtn, extra);
  if (reverseBtn) extra.insertBefore(a, reverseBtn);
  else            extra.appendChild(a);
}
