/**
 * Массовое скачивание в ZIP: целый альбом (модалка MusicPlaylistModal) и
 * «Вся музыка» (раздел /audios<owner>). Большие списки бьются на части.
 *
 * Migrated to DOMObserver + selectors: селекторы модалки/тулбара вынесены в
 * SELECTORS.music и читаются через safeQuerySelector/queryAll.
 */

import {
  sanitizeFilename,
  createBrandButton, setBrandButtonLabel,
  downloadCenterJobStart as jobStart,
  downloadCenterJobUpdate as jobUpdate,
  downloadCenterJobDone as jobDone,
  downloadCenterJobError as jobError,
  downloadCenterJobRemove as jobRemove,
} from '../_shared/index.js';
import { buildZip, type ZipEntry } from '@/shared/utils/zip.js';
import { downloadBlob } from '@/shared/utils/download.js';
import { requestPlaylist } from './ipc.js';
import { produceTrack, partsToBytes } from './pipeline.js';
import { acquireSlot, releaseSlot } from './queue.js';
import { fetchCover } from './meta.js';
import {
  findAudioRows, classicRowToEntry, vkuiRowToEntry, tupleToEntry,
} from './dom.js';
import { queryAll, safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { ALBUM_ATTR, ALL_ATTR } from './constants.js';
import type { TrackEntry } from './types.js';
import { t as tr } from '@/content/i18n/index.js';

function parseAlbumLink(modal: Element): { ownerId: string; playlistId: string; accessHash: string } | null {
  const a = safeQuerySelector<HTMLAnchorElement>(SELECTORS.music.albumLink, modal);
  const m = (a?.getAttribute('href') ?? '').match(/\/music\/album\/(-?\d+)_(\d+)_(\w+)/);
  return m ? { ownerId: m[1], playlistId: m[2], accessHash: m[3] } : null;
}

function getAlbumCoverUrl(modal: Element): string {
  const grid = safeQuerySelector<HTMLElement>(SELECTORS.music.albumCoverBg, modal);
  const m = (grid?.style.backgroundImage ?? '').match(/url\(["']?(https?:[^"')]+)["']?\)/);
  if (m) return m[1];
  const img = safeQuerySelector<HTMLImageElement>(SELECTORS.music.albumCoverImg, modal);
  return img?.src?.startsWith('http') ? img.src : '';
}

/** Фолбэк: дожимаем «Показать все», пока подгружаются строки. */
async function expandAllTracks(modal: Element): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const expand = safeQuerySelector<HTMLElement>(SELECTORS.music.albumExpandBtn, modal);
    if (!expand) break;
    const before = queryAll(SELECTORS.music.vkuiRoot, modal).length;
    expand.click();
    await new Promise(r => setTimeout(r, 800));
    const after = queryAll(SELECTORS.music.vkuiRoot, modal).length;
    if (after <= before) break;
  }
}

type Reporter = (text: string, loaded?: number, total?: number) => void;

interface ZipOptions {
  /** Размер части (MP3 крупные → защита от OOM). По умолчанию — весь список. */
  chunkSize?: number;
  /** Прерывание: останавливает формирование и сразу отдаёт уже готовое. */
  signal?: AbortSignal;
}

/**
 * Скачивает список треков в ZIP (с обложкой и _tracklist.txt). Большие списки
 * бьются на части по `chunkSize`. По сигналу отмены прекращает конвертацию и
 * упаковывает то, что уже готово, в архив — пользователь не теряет работу.
 */
async function zipAndDownload(
  entries: TrackEntry[],
  baseName: string,
  coverUrl: string,
  report: Reporter,
  { chunkSize = entries.length || 1, signal }: ZipOptions = {},
): Promise<{ ok: number; failed: number; cancelled: boolean }> {
  const numChunks = Math.max(1, Math.ceil(entries.length / chunkSize));
  const partPad = String(numChunks).length;
  const pad = String(entries.length).length;
  const total = entries.length;
  let ok = 0, failed = 0, done = 0, cancelled = false;

  let coverEntry: ZipEntry | null = null;
  if (coverUrl && !signal?.aborted) {
    const cov = await fetchCover(coverUrl);
    if (cov) coverEntry = { name: 'cover.jpg', data: cov.data };
  }

  for (let c = 0; c < numChunks && !cancelled; c++) {
    const slice = entries.slice(c * chunkSize, (c + 1) * chunkSize);
    const zipEntries: ZipEntry[] = coverEntry ? [coverEntry] : [];
    const tracklist: string[] = [];

    for (let j = 0; j < slice.length; j++) {
      if (signal?.aborted) { cancelled = true; break; }
      const gi  = c * chunkSize + j;
      const num = String(gi + 1).padStart(pad, '0');
      await acquireSlot();
      try {
        const { filename, parts, ext } = await produceTrack(
          slice[j], (s) => report(`${gi + 1}/${total} · ${s}`, done, total), signal,
        );
        zipEntries.push({ name: `${num}. ${sanitizeFilename(filename)}.${ext}`, data: partsToBytes(parts) });
        tracklist.push(`${num}. ${slice[j].performer} — ${slice[j].title}`);
        ok++;
      } catch {
        // Прервали текущий трек — не считаем его ошибкой, просто останавливаемся.
        if (signal?.aborted) cancelled = true;
        else { tracklist.push(`${num}. [${tr('music.failed_mark')}] ${slice[j].performer} — ${slice[j].title}`); failed++; }
      } finally {
        releaseSlot();
        done++;
        report(tr('music.ready_n', { done, total }), done, total);
      }
      if (cancelled) break;
    }

    // Упаковываем даже частичный результат — иначе при отмене работа пропала бы.
    if (tracklist.length === 0) continue;
    zipEntries.push({ name: '_tracklist.txt', data: `${baseName}\n\n${tracklist.join('\n')}\n` });

    report(cancelled ? tr('music.packing_ready') : tr('music.packing'), done, total);
    const fname = numChunks === 1
      ? `${baseName}.zip`
      : `${baseName}${tr('music.part', { n: String(c + 1).padStart(partPad, '0') })}.zip`;
    downloadBlob(buildZip(zipEntries), fname);
    if (!cancelled && c < numChunks - 1) await new Promise(r => setTimeout(r, 400));
  }

  return { ok, failed, cancelled };
}

/** Активный контроллер отмены для кнопки (повторный клик = «стоп и сохранить»). */
const activeStops = new WeakMap<HTMLElement, AbortController>();

/** Идёт ли по этой кнопке загрузка прямо сейчас. */
function isBusy(btn: HTMLElement): boolean {
  return btn.getAttribute('data-busy') === '1';
}

/** Управление «занятостью» брендовой кнопки. */
function setBusy(btn: HTMLElement, busy: boolean): void {
  if (busy) btn.setAttribute('data-busy', '1');
  else btn.removeAttribute('data-busy');
}

/**
 * Повторный клик по «занятой» кнопке = остановить и упаковать уже готовое.
 * Возвращает true, если был активный процесс (значит, клик «съеден» отменой).
 */
function requestStop(btn: HTMLElement): boolean {
  const ctrl = activeStops.get(btn);
  if (!ctrl || ctrl.signal.aborted) return false;
  ctrl.abort();
  setBrandButtonLabel(btn, tr('music.stopping'));
  return true;
}

async function downloadAlbum(modal: Element, btn: HTMLElement): Promise<void> {
  if (isBusy(btn)) { requestStop(btn); return; }
  setBusy(btn, true);

  const albumName = sanitizeFilename(
    safeQuerySelector(SELECTORS.music.albumModalTitle, modal)?.textContent?.trim() || 'album',
  );
  const jobId = `album:${albumName}`;
  const jobTitle = tr('music.album_job', { name: albumName });
  const ctrl = new AbortController();
  activeStops.set(btn, ctrl);
  const setLabel = (t: string): void => setBrandButtonLabel(btn, t);
  const report: Reporter = (t, loaded, total) => { setLabel(t); jobUpdate(jobId, t, loaded, total); };
  const restore = (d: number): void => { window.setTimeout(() => setLabel(tr('music.download_all')), d); };

  jobStart(jobId, jobTitle, () => { ctrl.abort(); report(tr('music.stopping')); });
  try {
    report(tr('music.fetching_list'));

    let entries: TrackEntry[] = [];
    const album = parseAlbumLink(modal);
    if (album) {
      const list = await requestPlaylist(album.ownerId, album.playlistId, album.accessHash);
      entries = list.map(tupleToEntry).filter((e): e is TrackEntry => e !== null);
    }
    if (entries.length === 0) { // фолбэк из DOM
      await expandAllTracks(modal);
      for (const row of queryAll(SELECTORS.music.vkuiRoot, modal)) {
        const e = vkuiRowToEntry(row);
        if (e) entries.push(e);
      }
    }
    if (entries.length === 0) { setLabel(tr('music.no_tracks')); jobError(jobId, tr('music.no_tracks')); restore(2500); return; }

    const { ok, failed, cancelled } = await zipAndDownload(
      entries, albumName, getAlbumCoverUrl(modal), report, { signal: ctrl.signal },
    );
    const tail = failed ? ` (−${failed})` : '';
    const summary = cancelled ? tr('music.stopped_summary', { ok, total: entries.length, tail }) : tr('music.done_summary', { ok, tail });
    setLabel(summary);
    if (ok > 0) jobDone(jobId, summary); else jobError(jobId, summary);
    restore(5000);
  } catch {
    setLabel(tr('music.error'));
    jobError(jobId, tr('music.error'));
    restore(3000);
  } finally {
    setBusy(btn, false);
    activeStops.delete(btn);
  }
}

async function downloadAllAudios(btn: HTMLElement): Promise<void> {
  if (isBusy(btn)) { requestStop(btn); return; }
  const ownerId = window.location.pathname.match(/\/audios(-?\d+)/)?.[1];
  if (!ownerId) return;

  setBusy(btn, true);
  const jobId = `all:${ownerId}`;
  const jobTitle = tr('music.all_music_job');
  const ctrl = new AbortController();
  activeStops.set(btn, ctrl);
  const setLabel = (t: string): void => setBrandButtonLabel(btn, t);
  const report: Reporter = (t, loaded, total) => { setLabel(t); jobUpdate(jobId, t, loaded, total); };
  const restore = (d: number): void => { window.setTimeout(() => setLabel(tr('music.download_all')), d); };

  jobStart(jobId, jobTitle, () => { ctrl.abort(); report(tr('music.stopping')); });
  try {
    report(tr('music.fetching_list'));

    // «-1» — весь раздел аудиозаписей пользователя.
    let entries = (await requestPlaylist(ownerId, '-1', ''))
      .map(tupleToEntry).filter((e): e is TrackEntry => e !== null);

    if (entries.length === 0) { // фолбэк: видимые строки на странице
      for (const row of findAudioRows()) {
        const e = classicRowToEntry(row);
        if (e) entries.push(e);
      }
      for (const row of queryAll(SELECTORS.music.vkuiRoot)) {
        const e = vkuiRowToEntry(row);
        if (e) entries.push(e);
      }
    }
    if (entries.length === 0) { setLabel(tr('music.no_tracks')); jobError(jobId, tr('music.no_tracks')); restore(2500); return; }

    setBusy(btn, false); // confirm не должен «подвешивать» кнопку
    const proceed = window.confirm(tr('music.confirm_all', { count: entries.length }));
    if (!proceed) { setLabel(tr('music.download_all')); jobRemove(jobId); return; }
    setBusy(btn, true);

    // Обложки у треков разные → общий cover.jpg не добавляем (он есть в ID3).
    const { ok, failed, cancelled } = await zipAndDownload(
      entries, `vkify-audios-${ownerId}`, '', report, { chunkSize: 25, signal: ctrl.signal },
    );
    const tail = failed ? ` (−${failed})` : '';
    const summary = cancelled ? tr('music.stopped_summary', { ok, total: entries.length, tail }) : tr('music.done_summary', { ok, tail });
    setLabel(summary);
    if (ok > 0) jobDone(jobId, summary); else jobError(jobId, summary);
    restore(6000);
  } catch {
    setLabel(tr('music.error'));
    jobError(jobId, tr('music.error'));
    restore(3000);
  } finally {
    setBusy(btn, false);
    activeStops.delete(btn);
  }
}

/** Кнопка «Скачать всё» в шапке списка треков альбома (рядом со счётчиком). */
export function injectAlbumButton(): void {
  const modal = safeQuerySelector(SELECTORS.music.albumModal);
  if (!modal || modal.querySelector(`[${ALBUM_ATTR}]`)) return;

  const header = safeQuerySelector<HTMLElement>(SELECTORS.music.albumTracksHeader, modal);
  if (!header) return;
  header.style.position = 'relative';

  const btn = createBrandButton(
    tr('music.download_all'),
    () => isBusy(btn) ? tr('music.stop_tooltip') : tr('music.album_tooltip'),
  );
  btn.setAttribute(ALBUM_ATTR, '');
  Object.assign(btn.style, { position: 'absolute', right: '8px', top: '6px' });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void downloadAlbum(modal, btn);
  });
  header.appendChild(btn);
}

/** Кнопка «Скачать всё» — в тулбаре headerlayout-aside рядом с иконками VK. */
export function injectAllAudiosButton(): void {
  const existing = document.querySelector(`[${ALL_ATTR}]`);

  // Кнопка осмысленна только в разделе аудиозаписей пользователя (/audios<owner>).
  // Тулбар headerlayout-aside есть и на других страницах — там её быть не должно.
  if (!/\/audios(-?\d+)/.test(window.location.pathname)) { existing?.remove(); return; }

  const group = safeQuerySelector<HTMLElement>(SELECTORS.common.headerAsideGroup);

  if (!group) { existing?.remove(); return; }
  if (existing) return;

  const btn = createBrandButton(
    tr('music.download_all'),
    () => isBusy(btn) ? tr('music.stop_tooltip') : tr('music.all_tooltip'),
  );
  btn.setAttribute(ALL_ATTR, '');
  // Компактный вид рядом с иконками 24px
  Object.assign(btn.style, { height: '28px', padding: '0 12px', borderRadius: '8px', alignSelf: 'center', boxShadow: 'none' });
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void downloadAllAudios(btn);
  });
  group.insertBefore(btn, group.firstElementChild);
}
