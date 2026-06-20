/**
 * Массовое скачивание в ZIP: целый альбом (модалка MusicPlaylistModal) и
 * «Вся музыка» (раздел /audios<owner>). Большие списки бьются на части.
 */

import {
  sanitizeFilename,
  createBrandButton, setBrandButtonLabel,
  downloadCenterJobStart as jobStart,
  downloadCenterJobUpdate as jobUpdate,
  downloadCenterJobDone as jobDone,
  downloadCenterJobError as jobError,
  downloadCenterJobRemove as jobRemove,
} from '../_shared.js';
import { buildZip, type ZipEntry } from '../../../../shared/utils/zip.js';
import { downloadBlob } from '../../../../shared/utils/download.js';
import { requestPlaylist } from './ipc.js';
import { produceMp3, partsToBytes } from './pipeline.js';
import { acquireSlot, releaseSlot } from './queue.js';
import { fetchCover } from './meta.js';
import {
  findAudioRows, classicRowToEntry, vkuiRowToEntry, tupleToEntry,
} from './dom.js';
import { ALBUM_ATTR, ALL_ATTR } from './constants.js';
import type { TrackEntry } from './types.js';

function parseAlbumLink(modal: Element): { ownerId: string; playlistId: string; accessHash: string } | null {
  const a = modal.querySelector<HTMLAnchorElement>('a[href*="/music/album/"]');
  const m = (a?.getAttribute('href') ?? '').match(/\/music\/album\/(-?\d+)_(\d+)_(\w+)/);
  return m ? { ownerId: m[1], playlistId: m[2], accessHash: m[3] } : null;
}

function getAlbumCoverUrl(modal: Element): string {
  const grid = modal.querySelector<HTMLElement>('[data-testid="audiolistboxheader-cover"] [style*="background-image"]');
  const m = (grid?.style.backgroundImage ?? '').match(/url\(["']?(https?:[^"')]+)["']?\)/);
  if (m) return m[1];
  const img = modal.querySelector<HTMLImageElement>('[data-testid="audiolistboxheader-cover"] img');
  return img?.src?.startsWith('http') ? img.src : '';
}

/** Фолбэк: дожимаем «Показать все», пока подгружаются строки. */
async function expandAllTracks(modal: Element): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const expand = modal.querySelector<HTMLElement>('[data-testid="audiolistitems-expandbutton"]');
    if (!expand) break;
    const before = modal.querySelectorAll('[class*="vkitAudioRow__root"]').length;
    expand.click();
    await new Promise(r => setTimeout(r, 800));
    const after = modal.querySelectorAll('[class*="vkitAudioRow__root"]').length;
    if (after <= before) break;
  }
}

/**
 * Скачивает список треков в ZIP (с обложкой и _tracklist.txt). Большие списки
 * бьются на части по `chunkSize` (MP3 крупные → защита от OOM).
 */
async function zipAndDownload(
  entries: TrackEntry[],
  baseName: string,
  coverUrl: string,
  report: (t: string) => void,
  chunkSize = entries.length || 1,
): Promise<{ ok: number; failed: number }> {
  const numChunks = Math.max(1, Math.ceil(entries.length / chunkSize));
  const partPad = String(numChunks).length;
  const pad = String(entries.length).length;
  let ok = 0, failed = 0;

  let coverEntry: ZipEntry | null = null;
  if (coverUrl) {
    const cov = await fetchCover(coverUrl);
    if (cov) coverEntry = { name: 'cover.jpg', data: cov.data };
  }

  for (let c = 0; c < numChunks; c++) {
    const slice = entries.slice(c * chunkSize, (c + 1) * chunkSize);
    const zipEntries: ZipEntry[] = coverEntry ? [coverEntry] : [];
    const tracklist: string[] = [];

    for (let j = 0; j < slice.length; j++) {
      const gi  = c * chunkSize + j;
      const num = String(gi + 1).padStart(pad, '0');
      await acquireSlot();
      try {
        const { filename, parts } = await produceMp3(slice[j], (s) => report(`${gi + 1}/${entries.length} · ${s}`));
        zipEntries.push({ name: `${num}. ${sanitizeFilename(filename)}.mp3`, data: partsToBytes(parts) });
        tracklist.push(`${num}. ${slice[j].performer} — ${slice[j].title}`);
        ok++;
      } catch {
        tracklist.push(`${num}. [не удалось] ${slice[j].performer} — ${slice[j].title}`);
        failed++;
      } finally {
        releaseSlot();
      }
    }

    if (tracklist.length === 0) continue;
    zipEntries.push({ name: '_tracklist.txt', data: `${baseName}\n\n${tracklist.join('\n')}\n` });

    report('Упаковка…');
    const fname = numChunks === 1
      ? `${baseName}.zip`
      : `${baseName} — часть ${String(c + 1).padStart(partPad, '0')}.zip`;
    downloadBlob(buildZip(zipEntries), fname);
    if (c < numChunks - 1) await new Promise(r => setTimeout(r, 400));
  }

  return { ok, failed };
}

/** Управление «занятостью» брендовой кнопки. */
function setBusy(btn: HTMLElement, busy: boolean): void {
  if (busy) btn.setAttribute('data-busy', '1');
  else btn.removeAttribute('data-busy');
}

async function downloadAlbum(modal: Element, btn: HTMLElement): Promise<void> {
  if (btn.getAttribute('data-busy') === '1') return;
  setBusy(btn, true);

  const albumName = sanitizeFilename(
    modal.querySelector('[data-testid="MusicPlaylistModal_Title"]')?.textContent?.trim() || 'album',
  );
  const jobId = `album:${albumName}`;
  const jobTitle = `Альбом: ${albumName}`;
  const setLabel = (t: string): void => setBrandButtonLabel(btn, t);
  const report = (t: string): void => { setLabel(t); jobUpdate(jobId, t); };
  const restore = (d: number): void => { window.setTimeout(() => setLabel('Скачать всё'), d); };

  jobStart(jobId, jobTitle);
  try {
    report('Получение списка…');

    let entries: TrackEntry[] = [];
    const album = parseAlbumLink(modal);
    if (album) {
      const list = await requestPlaylist(album.ownerId, album.playlistId, album.accessHash);
      entries = list.map(tupleToEntry).filter((e): e is TrackEntry => e !== null);
    }
    if (entries.length === 0) { // фолбэк из DOM
      await expandAllTracks(modal);
      for (const row of modal.querySelectorAll('[class*="vkitAudioRow__root"]')) {
        const e = vkuiRowToEntry(row);
        if (e) entries.push(e);
      }
    }
    if (entries.length === 0) { setLabel('Нет треков'); jobError(jobId, 'Нет треков'); restore(2500); return; }

    const { ok, failed } = await zipAndDownload(entries, albumName, getAlbumCoverUrl(modal), report);
    const summary = `Готово: ${ok}${failed ? ` (−${failed})` : ''}`;
    setLabel(summary);
    if (ok > 0) jobDone(jobId, summary); else jobError(jobId, summary);
    restore(5000);
  } catch {
    setLabel('Ошибка');
    jobError(jobId, 'Ошибка');
    restore(3000);
  } finally {
    setBusy(btn, false);
  }
}

async function downloadAllAudios(btn: HTMLElement): Promise<void> {
  if (btn.getAttribute('data-busy') === '1') return;
  const ownerId = window.location.pathname.match(/\/audios(-?\d+)/)?.[1];
  if (!ownerId) return;

  setBusy(btn, true);
  const jobId = `all:${ownerId}`;
  const jobTitle = 'Вся музыка';
  const setLabel = (t: string): void => setBrandButtonLabel(btn, t);
  const report = (t: string): void => { setLabel(t); jobUpdate(jobId, t); };
  const restore = (d: number): void => { window.setTimeout(() => setLabel('Скачать всё'), d); };

  jobStart(jobId, jobTitle);
  try {
    report('Получение списка…');

    // «-1» — весь раздел аудиозаписей пользователя.
    let entries = (await requestPlaylist(ownerId, '-1', ''))
      .map(tupleToEntry).filter((e): e is TrackEntry => e !== null);

    if (entries.length === 0) { // фолбэк: видимые строки на странице
      for (const row of findAudioRows()) {
        const e = classicRowToEntry(row);
        if (e) entries.push(e);
      }
      for (const row of document.querySelectorAll('[class*="vkitAudioRow__root"]')) {
        const e = vkuiRowToEntry(row);
        if (e) entries.push(e);
      }
    }
    if (entries.length === 0) { setLabel('Нет треков'); jobError(jobId, 'Нет треков'); restore(2500); return; }

    setBusy(btn, false); // confirm не должен «подвешивать» кнопку
    const proceed = window.confirm(
      `Скачать все треки (${entries.length}) одним архивом?\n` +
      'Конвертация идёт локально и может занять время; большой список разделится на части.',
    );
    if (!proceed) { setLabel('Скачать всё'); jobRemove(jobId); return; }
    setBusy(btn, true);

    // Обложки у треков разные → общий cover.jpg не добавляем (он есть в ID3).
    const { ok, failed } = await zipAndDownload(entries, `vkify-audios-${ownerId}`, '', report, 25);
    const summary = `Готово: ${ok}${failed ? ` (−${failed})` : ''}`;
    setLabel(summary);
    if (ok > 0) jobDone(jobId, summary); else jobError(jobId, summary);
    restore(6000);
  } catch {
    setLabel('Ошибка');
    jobError(jobId, 'Ошибка');
    restore(3000);
  } finally {
    setBusy(btn, false);
  }
}

/** Кнопка «Скачать всё» в шапке списка треков альбома (рядом со счётчиком). */
export function injectAlbumButton(): void {
  const modal = document.querySelector('[data-testid="MusicPlaylistModal"]');
  if (!modal || modal.querySelector(`[${ALBUM_ATTR}]`)) return;

  const header = modal.querySelector<HTMLElement>('[data-testid="MusicPlaylistTracks_Header"]');
  if (!header) return;
  header.style.position = 'relative';

  const btn = createBrandButton('Скачать всё', 'Скачать альбом: треки MP3 + обложка');
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
  const group = document.querySelector<HTMLElement>(
    '[data-testid="headerlayout-aside"] .vkuiButtonGroup__host, ' +
    '[data-testid="headerlayout-aside"] [role="group"]',
  );
  const existing = document.querySelector(`[${ALL_ATTR}]`);

  if (!group) { existing?.remove(); return; }
  if (existing) return;

  const btn = createBrandButton('Скачать всё', 'Скачать все треки пользователя в ZIP');
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
