/**
 * Скачивание фото и альбомов VK.
 *
 *  • Просмотр фото (`#pv_box`) — кнопка «Скачать» в `.pv_bottom_actions`,
 *    оригинал максимального размера через `photos.getById`.
 *  • Страница альбома (`/album<owner>_<id>`) — VKUI или классический
 *    интерфейс. Перебираем `photos.get` пачками по 1000 и упаковываем в
 *    ZIP-архив (или несколько чанков по 500 фото при больших альбомах).
 */

import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { vkApi } from '../../api/vk-api-client.js';
import {
  requestDownload, sanitizeFilename, buildDownloadIconSvg,
  attachBrandTooltip, removeBrandTooltip,
} from './_shared.js';
import { buildZip, type ZipEntry } from '../../../shared/utils/zip.js';
import { downloadBlob } from '../../../shared/utils/download.js';

const PV_BTN_ID        = 'vkify-photo-dl-btn';
const ALBUM_BTN_ID     = 'vkify-album-dl-btn';
const CLASSIC_BTN_ID   = 'vkify-album-dl-btn-classic';
const STYLE_ID         = 'vkify-photo-dl-style';
const POLL_INTERVAL    = 800;
const PHOTOS_GET_LIMIT = 1000; // максимум VK API photos.get
const ZIP_CHUNK_SIZE   = 500;  // фото в одном архиве — защита от OOM

interface PhotoSize  { url: string; width: number; height: number; type: string }
interface PhotoItem  { id: number; owner_id: number; sizes: PhotoSize[] }
interface PhotosGetResponse { count: number; items: PhotoItem[] }

function isVkHost(): boolean {
  const host = window.location.hostname;
  return host === 'vk.com' || host === 'vk.ru';
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** `/album<owner>_<id>` — id может быть числом или placeholder'ом `0`/`000`. */
function parseAlbumPath(pathname: string): { ownerId: number; albumId: string } | null {
  const m = pathname.match(/^\/album(-?\d+)_(\w+)$/);
  if (!m) return null;
  return { ownerId: Number(m[1]), albumId: m[2] };
}

/** Photo-id из `.like_wrap._like_photo<owner>_<id>` или data-options фолбэка. */
function findCurrentPhotoId(): { ownerId: number; photoId: number } | null {
  const likeWrap = document.querySelector<HTMLElement>(
    '#pv_box .like_wrap, #pv_box [class*="_like_photo"]',
  );
  if (likeWrap) {
    for (const cls of Array.from(likeWrap.classList)) {
      const m = cls.match(/^_like_photo(-?\d+)_(\d+)$/);
      if (m) return { ownerId: Number(m[1]), photoId: Number(m[2]) };
    }
  }
  const dataAlt = document.querySelector<HTMLElement>(
    '#pv_box [data-task-click="Page/owner_set_exist_photo"]',
  );
  const opt = dataAlt?.getAttribute('data-options');
  if (opt) {
    const m = opt.match(/"photo":"(-?\d+)_(\d+)"/);
    if (m) return { ownerId: Number(m[1]), photoId: Number(m[2]) };
  }
  return null;
}

function getBestPhotoUrl(sizes: PhotoSize[]): string | null {
  if (!sizes.length) return null;
  return [...sizes].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0].url;
}

// ── API ─────────────────────────────────────────────────────────────────────

async function fetchPhoto(ownerId: number, photoId: number): Promise<PhotoItem | null> {
  try {
    // photo_sizes=1 — массив `sizes` вместо legacy полей photo_75/130/…
    // photos.getById возвращает массив фото напрямую, а не {count, items}.
    const resp = await vkApi.call('photos.getById', {
      photos:      `${ownerId}_${photoId}`,
      extended:    0,
      photo_sizes: 1,
    }) as PhotoItem[] | { items?: PhotoItem[] };

    const item = Array.isArray(resp) ? resp[0] : resp?.items?.[0];
    if (!item) console.warn('[VKify] photos.getById — пустой ответ:', resp);
    return item ?? null;
  } catch (err) {
    console.error('[VKify] photos.getById failed:', err);
    return null;
  }
}

async function fetchAlbumPage(
  ownerId: number,
  albumId: string | number,
  offset: number,
): Promise<PhotosGetResponse | null> {
  try {
    return await vkApi.call('photos.get', {
      owner_id:    ownerId,
      album_id:    albumId,
      offset,
      count:       PHOTOS_GET_LIMIT,
      rev:         0,
      photo_sizes: 1,
    }) as PhotosGetResponse;
  } catch (err) {
    console.warn(`[VKify] photos.get(album_id=${albumId}) failed:`, err);
    return null;
  }
}

/**
 * VK URL содержит album_id как число или placeholder `0`/`000` для системных
 * альбомов — API же ждёт строки `wall` / `profile` / `saved`. Для сообществ
 * (ownerId<0) placeholder обычно = wall, для пользователей = saved.
 */
function albumIdCandidates(raw: string, ownerId: number): (string | number)[] {
  const n = Number(raw);
  if (Number.isFinite(n) && /^-?\d+$/.test(raw) && n > 0) return [n];
  if (/^0+$/.test(raw)) {
    return ownerId < 0
      ? ['wall', 'profile', 'saved', 0]
      : ['saved', 'wall', 'profile', 0];
  }
  return [raw];
}

/**
 * Все фото альбома постранично, с retry и rate-limit паузами.
 *
 *   • Для каждой страницы 1 retry с задержкой 600ms.
 *   • 350ms между страницами под VK rate-limit (~3 req/s на токен).
 *   • Терпим до 3 пустых подряд если что-то уже получили.
 *   • Лимит 200 страниц = 200k фото.
 */
async function fetchAlbumPhotos(ownerId: number, albumId: string): Promise<PhotoItem[]> {
  for (const candidate of albumIdCandidates(albumId, ownerId)) {
    const all: PhotoItem[] = [];
    let offset = 0;
    let success = false;
    let consecutiveFailures = 0;

    for (let i = 0; i < 200; i++) {
      let resp = await fetchAlbumPage(ownerId, candidate, offset);
      if (!resp) {
        await sleep(600);
        resp = await fetchAlbumPage(ownerId, candidate, offset);
      }
      if (!resp?.items?.length) {
        if (success && ++consecutiveFailures < 3) { await sleep(1000); continue; }
        break;
      }
      consecutiveFailures = 0;
      success = true;
      all.push(...resp.items);
      if (all.length >= resp.count) break;
      if (resp.items.length < PHOTOS_GET_LIMIT) break;
      offset = all.length;
      await sleep(350);
    }

    if (success && all.length > 0) return all;
  }
  console.warn(`[VKify] Альбом ${ownerId}_${albumId} — фото не получены`);
  return [];
}

/** Скачивает фото как байты с 1 retry. */
async function fetchPhotoBytes(url: string): Promise<Uint8Array<ArrayBuffer> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, { credentials: 'omit', cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return new Uint8Array(await resp.arrayBuffer());
    } catch (err) {
      if (attempt === 1) {
        console.warn(`[VKify] fetch photo failed (${url}):`, err);
        return null;
      }
      await sleep(400);
    }
  }
  return null;
}

/**
 * Скачивает альбом как ZIP. При размере > ZIP_CHUNK_SIZE — несколько частей
 * `…-part-NN.zip`, чтобы не упереться в память.
 */
async function downloadAlbumAll(
  ownerId: number,
  albumId: string,
  onProgress: (done: number, total: number) => void,
): Promise<{ ok: number; total: number; failed: number }> {
  const items = await fetchAlbumPhotos(ownerId, albumId);
  if (items.length === 0) return { ok: 0, total: 0, failed: 0 };

  const idxPad      = String(items.length).length;
  const numChunks   = Math.ceil(items.length / ZIP_CHUNK_SIZE);
  const partPad     = String(numChunks).length;
  const baseName    = `vkify-album-${ownerId}_${albumId}`;
  let ok      = 0;
  let failed  = 0;

  for (let c = 0; c < numChunks; c++) {
    const slice   = items.slice(c * ZIP_CHUNK_SIZE, (c + 1) * ZIP_CHUNK_SIZE);
    const entries: ZipEntry[] = [];

    for (let j = 0; j < slice.length; j++) {
      const globalIdx = c * ZIP_CHUNK_SIZE + j;
      const item      = slice[j];
      const url       = getBestPhotoUrl(item.sizes);
      if (!url) {
        failed++;
        onProgress(globalIdx + 1, items.length);
        continue;
      }
      const bytes = await fetchPhotoBytes(url);
      if (!bytes) {
        failed++;
        onProgress(globalIdx + 1, items.length);
        continue;
      }
      const idx = String(globalIdx + 1).padStart(idxPad, '0');
      entries.push({ name: `photo_${idx}_${item.id}.jpg`, data: bytes });
      ok++;
      onProgress(globalIdx + 1, items.length);
      await sleep(40);
    }

    if (entries.length === 0) continue;

    const filename = numChunks === 1
      ? `${baseName}.zip`
      : `${baseName}-part-${String(c + 1).padStart(partPad, '0')}.zip`;
    downloadBlob(buildZip(entries), filename);

    if (c < numChunks - 1) await sleep(400);
  }
  return { ok, total: items.length, failed };
}

// ── Стили ──────────────────────────────────────────────────────────────────

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${PV_BTN_ID} { font-weight: 600; }
    #${PV_BTN_ID}[disabled],
    #${ALBUM_BTN_ID}[disabled] { opacity: 0.6; pointer-events: none; cursor: wait; }

    @keyframes vkify-album-pulse {
      0%   { transform: translateY(0);   opacity: 1; }
      50%  { transform: translateY(2px); opacity: 0.6; }
      100% { transform: translateY(0);   opacity: 1; }
    }
    #${ALBUM_BTN_ID}[disabled] svg { animation: vkify-album-pulse 1s ease-in-out infinite; }

    @keyframes vkify-pb-fadein {
      from { opacity: 0; transform: translateX(-4px); }
      to   { opacity: 1; transform: translateX(0);    }
    }
    .vkify-pb {
      display: inline-flex; align-items: center; gap: 8px;
      margin-left: 8px; vertical-align: middle;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: vkify-pb-fadein 0.18s ease;
    }
    .vkify-pb-track {
      width: 100px; height: 4px; border-radius: 2px;
      background: rgba(120, 120, 120, 0.25); overflow: hidden; position: relative;
    }
    .vkify-pb-fill {
      height: 100%; width: 0%; border-radius: 2px;
      background: linear-gradient(90deg, #4caf50 0%, #66bb6a 100%);
      transition: width 0.25s ease;
    }
    .vkify-pb-fill.vkify-pb-done { background: linear-gradient(90deg, #4caf50 0%, #2e7d32 100%); }
    .vkify-pb-fill.vkify-pb-err  { background: linear-gradient(90deg, #ef5350 0%, #c62828 100%); }
    .vkify-pb-text {
      font-size: 11px; font-weight: 600; letter-spacing: 0.01em;
      color: var(--vkui--color_text_secondary, #707579);
      white-space: nowrap; min-width: 42px;
    }
  `;
  document.head.appendChild(style);
}

// ── Кнопка в photoviewer (`#pv_box`) ───────────────────────────────────────

function injectPhotoViewerButton(): void {
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

// ── Прогресс-бар ──────────────────────────────────────────────────────────

interface ProgressBar {
  el:     HTMLElement;
  set:    (done: number, total: number) => void;
  finish: (ok: number, total: number, failed: number) => void;
  error:  () => void;
  remove: () => void;
}

/** Inline-прогресс «████ 23/450» — track + fill + текст. */
function createProgressBar(): ProgressBar {
  const root = document.createElement('span');
  root.className = 'vkify-pb';

  const track = document.createElement('span');
  track.className = 'vkify-pb-track';

  const fill = document.createElement('span');
  fill.className = 'vkify-pb-fill';
  track.appendChild(fill);

  const text = document.createElement('span');
  text.className = 'vkify-pb-text';
  text.textContent = '0/?';

  root.appendChild(track);
  root.appendChild(text);

  let removed = false;

  return {
    el: root,
    set(done, total) {
      if (removed || total <= 0) return;
      const pct = Math.min(100, Math.round((done / total) * 100));
      fill.style.width = `${pct}%`;
      text.textContent = `${done}/${total}`;
    },
    finish(ok, total, failed) {
      if (removed) return;
      fill.style.width = '100%';
      fill.classList.add('vkify-pb-done');
      text.textContent = failed > 0 ? `${ok}/${total} (×${failed})` : `${ok}/${total} ✓`;
    },
    error() {
      if (removed) return;
      fill.classList.add('vkify-pb-err');
      text.textContent = 'Ошибка';
    },
    remove() {
      if (removed) return;
      removed = true;
      root.remove();
    },
  };
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

    try {
      const res = await downloadAlbumAll(ids.ownerId, ids.albumId, (done, total) => {
        ctl.setStatus(`Скачано ${done}/${total}`);
        pb.set(done, total);
      });
      const tail = res.failed > 0 ? ` (ошибок: ${res.failed})` : '';
      ctl.setStatus(`Готово: ${res.ok}/${res.total}${tail} ✓`);
      pb.finish(res.ok, res.total, res.failed);
      setTimeout(() => { ctl.setStatus(ctl.initialTitle); pb.remove(); }, 4000);
    } catch {
      ctl.setStatus('Ошибка');
      pb.error();
      setTimeout(() => { ctl.setStatus(ctl.initialTitle); pb.remove(); }, 2500);
    } finally {
      ctl.setBusy(false);
    }
  });
}

/** VKUI-страницы альбомов (`[data-testid="headerlayout-aside"]`). */
function injectAlbumPageButton(): void {
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
function injectClassicAlbumPageButton(): void {
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

// ── Сканирование ───────────────────────────────────────────────────────────

function scan(): void {
  if (!isVkHost()) return;
  injectPhotoViewerButton();
  injectAlbumPageButton();          // VKUI-страницы альбомов
  injectClassicAlbumPageButton();   // Классический #photos_all_block (группы и т.п.)
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

// ── FeatureMap export ──────────────────────────────────────────────────────

export function createPhotoDownloadFeature(_manager: FeatureManager): FeatureMap {
  let observer:     MutationObserver | null = null;
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function start(): void {
    scan();
    observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    pollInterval = setInterval(scan, POLL_INTERVAL);
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;
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