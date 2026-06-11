/**
 * Инжекция кнопок скачивания: в photoviewer (`#pv_box`), на VKUI-странице
 * альбома и на классической `#photos_all_block`. Общий handler альбома —
 * confirm → прогресс-бар → ZIP.
 */

import {
  requestDownload, buildDownloadIconSvg, attachBrandTooltip,
  downloadCenterJobStart, downloadCenterJobUpdate,
  downloadCenterJobDone, downloadCenterJobError,
} from '../_shared.js';
import { injectStyle } from './styles.js';
import { createProgressBar } from './progress-bar.js';
import { parseAlbumPath, findCurrentPhotoId, getBestPhotoUrl, fetchPhoto } from './api.js';
import { downloadAlbumAll } from './zip-album.js';
import { PV_BTN_ID, ALBUM_BTN_ID, CLASSIC_BTN_ID } from './constants.js';

// ── Кнопка в photoviewer (`#pv_box`) ───────────────────────────────────────

export function injectPhotoViewerButton(): void {
  const overlay = document.querySelector<HTMLElement>('#pv_box');
  if (!overlay || overlay.querySelector(`#${PV_BTN_ID}`)) return;
  const actions = overlay.querySelector<HTMLElement>('.pv_bottom_actions');
  if (!actions) return;

  injectStyle();

  const divider = document.createElement('span');
  divider.className = 'divider';

  const btn = document.createElement('button');
  btn.id          = PV_BTN_ID;
  btn.type        = 'button';
  btn.setAttribute('aria-label', 'Скачать фото в максимальном качестве');
  btn.textContent = 'Скачать';
  attachBrandTooltip(btn, 'Скачать фото в максимальном качестве');

  const flash = (msg: string): void => {
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = 'Скачать'; }, 1500);
  };

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const ids = findCurrentPhotoId();
    if (!ids) { flash('Нет ID'); return; }

    btn.disabled = true;
    btn.textContent = 'Загрузка…';
    try {
      const photo = await fetchPhoto(ids.ownerId, ids.photoId);
      if (!photo) { flash('Ошибка API'); return; }
      if (!photo.sizes?.length) { flash('Нет sizes'); return; }
      const url = getBestPhotoUrl(photo.sizes);
      if (!url) { flash('Нет ссылки'); return; }
      requestDownload(url, `photo_${ids.ownerId}_${ids.photoId}.jpg`);
      flash('Готово ✓');
    } finally {
      btn.disabled = false;
    }
  });

  // Между «Удалить» и «Ещё», после собственного divider.
  const moreBtn = actions.querySelector('.pv_actions_more');
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

const CONFIRM_MSG =
  'Скачать ВСЕ фото из этого альбома?\n\n' +
  'Будет создан ZIP-архив (или несколько по 500 фото для больших альбомов).';

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
    if (!window.confirm(CONFIRM_MSG)) return;

    ctl.setBusy(true);
    ctl.setStatus('Подготовка…');
    const pb = createProgressBar();
    trigger.insertAdjacentElement('afterend', pb.el);

    const jobId = `album-photos:${ids.ownerId}_${ids.albumId}`;
    downloadCenterJobStart(jobId, 'Альбом фото');

    try {
      const res = await downloadAlbumAll(ids.ownerId, ids.albumId, (done, total) => {
        ctl.setStatus(`Скачано ${done}/${total}`);
        downloadCenterJobUpdate(jobId, `Скачано ${done}/${total}`);
        pb.set(done, total);
      });
      const tail = res.failed > 0 ? ` (ошибок: ${res.failed})` : '';
      ctl.setStatus(`Готово: ${res.ok}/${res.total}${tail} ✓`);
      downloadCenterJobDone(jobId, `Готово: ${res.ok}/${res.total}${tail}`);
      pb.finish(res.ok, res.total, res.failed);
      setTimeout(() => { ctl.setStatus(ctl.initialTitle); pb.remove(); }, 4000);
    } catch {
      ctl.setStatus('Ошибка');
      downloadCenterJobError(jobId, 'Ошибка');
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

  const aside = document.querySelector<HTMLElement>(
    '[data-testid="headerlayout-aside"] [role="group"], [data-testid="headerlayout-aside"] .vkuiButtonGroup__host',
  );
  const refBtn = aside?.querySelector<HTMLButtonElement>('button');
  if (!aside || !refBtn) return;

  injectStyle();

  // Делаем icon-only по образцу «···» — `vkuiButton__singleIcon` уже в className.
  const btn = document.createElement('button');
  btn.id        = ALBUM_BTN_ID;
  btn.type      = 'button';
  btn.className = refBtn.className;
  btn.setAttribute('aria-label', 'Скачать альбом');
  attachBrandTooltip(btn, 'Скачать альбом (ZIP)');

  const inner = document.createElement('span');
  inner.className = 'vkuiButton__in';
  const before = document.createElement('span');
  before.className = 'vkuiButton__before';
  before.setAttribute('role', 'presentation');
  before.appendChild(buildDownloadIconSvg(20));
  inner.appendChild(before);
  btn.appendChild(inner);

  attachAlbumDownloadHandler(btn, ids, {
    initialTitle: 'Скачать альбом',
    setBusy:   (b) => { btn.disabled = b; },
    setStatus: (text) => { btn.setAttribute('aria-label', text); },
  });

  aside.insertBefore(btn, aside.firstElementChild);
}

/** Классические страницы `#photos_all_block` — нет headerlayout-aside. */
export function injectClassicAlbumPageButton(): void {
  const ids = parseAlbumPath(window.location.pathname);
  if (!ids || document.getElementById(CLASSIC_BTN_ID)) return;

  const block = document.getElementById('photos_all_block');
  const extra = block?.querySelector<HTMLElement>('.page_block_header_extra, ._header_extra');
  if (!extra) return;

  injectStyle();

  // Класс `photos_album_reverse_btn` наследует hover/цвет от соседней reverse-кнопки.
  const a = document.createElement('a');
  a.id        = CLASSIC_BTN_ID;
  a.href      = '#';
  a.className = 'photos_album_reverse_btn';
  a.setAttribute('role', 'button');
  a.setAttribute('aria-label', 'Скачать альбом');
  attachBrandTooltip(a, 'Скачать альбом (ZIP)');
  Object.assign(a.style, { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginRight: '4px' });
  a.appendChild(buildDownloadIconSvg(24));

  attachAlbumDownloadHandler(a, ids, {
    initialTitle: 'Скачать альбом',
    setBusy:   (b) => {
      a.style.pointerEvents = b ? 'none' : '';
      a.style.opacity       = b ? '0.5'  : '';
    },
    setStatus: (text) => { a.setAttribute('aria-label', text); },
  });

  const reverseBtn = extra.querySelector('.photos_album_reverse_btn');
  if (reverseBtn) extra.insertBefore(a, reverseBtn);
  else            extra.appendChild(a);
}
