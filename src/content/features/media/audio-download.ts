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
 */

import Hls from 'hls.js';
import { Mp3Encoder } from '@breezystack/lamejs';
import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { dispatchPageEvent } from '../../utils/page-event.js';
import {
  sanitizeFilename, buildDownloadIconSvg,
  hideBrandTooltip, attachBrandTooltip, removeBrandTooltip,
  createBrandButton, setBrandButtonLabel, removeBrandButtonStyles,
  downloadCenterJobStart as jobStart,
  downloadCenterJobUpdate as jobUpdate,
  downloadCenterJobDone as jobDone,
  downloadCenterJobError as jobError,
  downloadCenterJobRemove as jobRemove,
  ensureDownloadCenter,
} from './_shared.js';
import { buildId3Tag, type Id3Meta } from './id3.js';
import { buildZip, type ZipEntry } from '../../../shared/utils/zip.js';
import { downloadBlob } from '../../../shared/utils/download.js';

// ── Типы ──────────────────────────────────────────────────────────────────────

interface TrackEntry {
  trackId: string;
  title: string;
  performer: string;
  coverUrl: string;
  audioData: unknown[];
  cachedUrl?: string;
}

interface DownloadSettings {
  bitrate: number;
  filenameFormat: string;
  id3: boolean;
  lyrics: boolean;
}

// ── Константы ─────────────────────────────────────────────────────────────────

const BUTTON_ATTR  = 'data-vkify-adl';
const STATUS_ATTR  = 'data-vkify-adl-status';
const ALBUM_ATTR   = 'data-vkify-adl-album';
const ALL_ATTR     = 'data-vkify-adl-all';
const PLAYER_ATTR  = 'data-vkify-adl-player';
const STYLES_ID    = 'vkify-adl-css';
let   reqCounter   = 0;

// Параллельные загрузки тяжело грузят main-thread (HLS-демукс без воркера,
// decodeAudioData, MP3-кодирование) — больше двух одновременно подвешивают VK.
// Поэтому ограничиваем конкурентность, остальные ждут в очереди.
const MAX_CONCURRENT = 2;

// ── Локальный кеш треков ──────────────────────────────────────────────────────

const trackCache = new Map<string, TrackEntry>();

// ── Очередь загрузок (семафор) ─────────────────────────────────────────────────

let activeDownloads = 0;
const waitQueue: Array<() => void> = [];

/** Ждёт свободный слот. Резолвится сразу, если активных < лимита. */
function acquireSlot(): Promise<void> {
  if (activeDownloads < MAX_CONCURRENT) {
    activeDownloads++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waitQueue.push(resolve));
}

/** Освобождает слот: передаёт его следующему в очереди либо уменьшает счётчик. */
function releaseSlot(): void {
  const next = waitQueue.shift();
  if (next) next();
  else activeDownloads = Math.max(0, activeDownloads - 1);
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function ensureStyles(): void {
  if (document.getElementById(STYLES_ID)) return;
  const s = document.createElement('style');
  s.id = STYLES_ID;
  s.textContent = `
    /* ── Кнопка: повторяет структуру нативных VK audio_row__action ── */
    .vkify-dl-btn .audio_row__icon {
      position: relative;
      width: 20px; height: 20px;
    }
    /* Основная иконка ⬇ — в потоке, задаёт размеры бокса */
    .vkify-dl-ic-dl {
      display: flex; align-items: center; justify-content: center;
      width: 20px; height: 20px;
    }
    .vkify-dl-ic-dl svg { display: block; }
    /* Оверлеи (спиннер/✓/✗) — поверх, абсолютно, по центру 20×20 */
    .vkify-dl-ic-spin, .vkify-dl-ic-ok, .vkify-dl-ic-err {
      display: none;
      position: absolute; top: 0; left: 0;
      width: 20px; height: 20px;
      align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; line-height: 1;
    }

    @keyframes vkify-spin {
      to { transform: rotate(360deg); }
    }
    .vkify-dl-ic-spin::before {
      content: ''; display: block;
      width: 14px; height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: vkify-spin .7s linear infinite;
    }

    /* Переключение состояний по классу на кнопке */
    .vkify-dl-btn.is-loading .vkify-dl-ic-dl,
    .vkify-dl-btn.is-done    .vkify-dl-ic-dl,
    .vkify-dl-btn.is-error   .vkify-dl-ic-dl { visibility: hidden; }
    .vkify-dl-btn.is-loading { color: var(--vkui--color_text_accent, #2688eb) !important; }
    .vkify-dl-btn.is-loading .vkify-dl-ic-spin { display: flex; }
    .vkify-dl-btn.is-done    { color: #4bb34b !important; }
    .vkify-dl-btn.is-done    .vkify-dl-ic-ok  { display: flex; }
    .vkify-dl-btn.is-error   { color: #e64646 !important; }
    .vkify-dl-btn.is-error   .vkify-dl-ic-err { display: flex; }

    /* ── Инлайн-статус — внутри элемента длительности, рядом со временем ──
       Наследует visibility от ._audio_row__duration: VK сам прячет время и
       показывает кнопки при наведении и возвращает время при уходе курсора. */
    .vkify-dl-status {
      display: none;
      align-items: center; gap: 4px;
      margin-left: 8px; max-width: 220px;
      font-size: 11px; font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      vertical-align: middle;
      color: var(--vkui--color_text_secondary, #818c99);
    }
    .vkify-dl-status.is-visible { display: inline-flex; }
    .vkify-dl-status-dot {
      flex: 0 0 auto;
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor;
    }
    .vkify-dl-status.s-load { color: var(--vkui--color_text_accent, #2688eb); }
    .vkify-dl-status.s-load .vkify-dl-status-dot { animation: vkify-pulse 1s ease-in-out infinite; }
    .vkify-dl-status.s-done { color: #4bb34b; }
    .vkify-dl-status.s-err  { color: #e64646; }
    .vkify-dl-status-text { overflow: hidden; text-overflow: ellipsis; }
    @keyframes vkify-pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
  `;
  document.head.appendChild(s);
}

// ── DOM-утилиты ───────────────────────────────────────────────────────────────

function findAudioRows(): Element[] {
  const rows = document.querySelectorAll<Element>('.audio_row[data-full-id], ._audio_row[data-full-id]');
  if (rows.length > 0) return Array.from(rows);
  return Array.from(document.querySelectorAll('[class*="AudioRow_root"][data-full-id], [class*="AudioRow__root"][data-full-id]'));
}

function parseAudioData(row: Element): unknown[] | null {
  const raw = row.getAttribute('data-audio');
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as unknown;
    return Array.isArray(p) ? p : null;
  } catch { return null; }
}

function extractMeta(row: Element, data: unknown[]): { title: string; performer: string; coverUrl: string } {
  const performer = (
    row.querySelector('._audio_row__performers') ??
    row.querySelector('.audio_row__performers')
  )?.textContent?.trim() || String(data[4] ?? '');

  const title = (
    row.querySelector('._audio_row__title_inner') ??
    row.querySelector('.audio_row__title_inner') ??
    row.querySelector('._audio_row__title') ??
    row.querySelector('.audio_row__title')
  )?.textContent?.trim() || String(data[3] ?? '');

  return { title, performer, coverUrl: extractCoverUrl(row, data) };
}

/** URL обложки трека: сперва из <img> в строке, иначе из data-audio[14]. */
function extractCoverUrl(row: Element, data: unknown[]): string {
  const img = row.querySelector<HTMLImageElement>('img.audio_row__cover, img._audio_row__cover');
  if (img?.src?.startsWith('http')) return img.src;

  const raw = data[14];
  if (typeof raw === 'string') {
    const first = raw.split(',')[0]?.trim();
    if (first?.startsWith('http')) return first;
  }
  return '';
}

/** Находит место вставки кнопки — внутри нативного контейнера `._audio_row__actions`. */
function findActionsContainer(row: Element): Element | null {
  return row.querySelector('._audio_row__actions') ?? row.querySelector('.audio_row__actions');
}

// ── Запрос URL через инжектированный скрипт ───────────────────────────────────

function requestUrl(entry: TrackEntry): Promise<string> {
  return new Promise<string>((resolve) => {
    const requestId = `${entry.trackId}_${++reqCounter}`;

    const handler = (e: Event): void => {
      const d = (e as CustomEvent<{ requestId: string; url: string }>).detail;
      if (d.requestId !== requestId) return;
      window.removeEventListener('vkify:audio:url-response', handler);
      resolve(d.url ?? '');
    };

    window.addEventListener('vkify:audio:url-response', handler);
    setTimeout(() => {
      window.removeEventListener('vkify:audio:url-response', handler);
      resolve('');
    }, 12000);

    dispatchPageEvent('vkify:audio:get-url', { requestId, audioData: entry.audioData });
  });
}

// ── Настройки скачивания ──────────────────────────────────────────────────────

async function getDownloadSettings(): Promise<DownloadSettings> {
  try {
    const stored = await chrome.storage.local.get([
      'audio_download_bitrate', 'audio_download_filename',
      'audio_download_id3', 'audio_download_lyrics',
    ]);
    return {
      bitrate:        Number(stored['audio_download_bitrate']  ?? 192),
      filenameFormat: String(stored['audio_download_filename'] ?? 'artist_title'),
      id3:            stored['audio_download_id3']    !== false, // по умолчанию вкл
      lyrics:         stored['audio_download_lyrics'] === true,  // по умолчанию выкл
    };
  } catch {
    return { bitrate: 192, filenameFormat: 'artist_title', id3: true, lyrics: false };
  }
}

function buildFilename(performer: string, title: string, format: string): string {
  switch (format) {
    case 'title_artist': return sanitizeFilename(`${title} - ${performer}`);
    case 'title':        return sanitizeFilename(title || performer);
    default:             return sanitizeFilename(`${performer} - ${title}`);
  }
}

// ── Метаданные (обложка + текст) через background ──────────────────────────────

async function fetchCover(url: string): Promise<{ data: Uint8Array; mime: string } | null> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'AUDIO_FETCH_COVER', url }) as
      { success: boolean; dataB64?: string; mime?: string } | undefined;
    if (!resp?.success || !resp.dataB64) return null;
    const bin  = atob(resp.dataB64);
    const data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
    return { data, mime: resp.mime || 'image/jpeg' };
  } catch { return null; }
}

async function fetchLyrics(artist: string, title: string): Promise<string> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'AUDIO_FETCH_LYRICS', artist, title }) as
      { success: boolean; lyrics?: string } | undefined;
    return resp?.success && resp.lyrics ? resp.lyrics : '';
  } catch { return ''; }
}

/** Собирает ID3-метаданные (обложка/текст тянутся параллельно). */
async function buildMeta(entry: TrackEntry, cfg: DownloadSettings): Promise<Id3Meta | null> {
  if (!cfg.id3 && !cfg.lyrics) return null;

  const meta: Id3Meta = { title: entry.title, artist: entry.performer };
  const tasks: Promise<void>[] = [];

  if (cfg.id3 && entry.coverUrl) {
    tasks.push(fetchCover(entry.coverUrl).then((c) => { if (c) meta.cover = c; }));
  }
  if (cfg.lyrics) {
    tasks.push(fetchLyrics(entry.performer, entry.title).then((l) => { if (l) meta.lyrics = l; }));
  }

  await Promise.all(tasks);
  return meta;
}

// ── Готовый MP3 (URL → HLS → MP3 → ID3) ─────────────────────────────────────────

/** Полный конвейер одного трека: возвращает имя файла и части MP3 (с ID3). */
async function produceMp3(
  entry: TrackEntry,
  onProgress: (s: string) => void,
): Promise<{ filename: string; parts: BlobPart[] }> {
  let url = entry.cachedUrl ?? '';
  if (!url) {
    url = await requestUrl(entry);
    if (url) entry.cachedUrl = url;
  }
  if (!url) throw new Error('Ссылка недоступна');

  const cfg = await getDownloadSettings();
  const filename = buildFilename(entry.performer, entry.title, cfg.filenameFormat);

  const metaPromise = buildMeta(entry, cfg); // обложка/текст параллельно с потоком
  const mp3Parts = await fetchAndEncode(url, cfg.bitrate, onProgress);
  const meta = await metaPromise;

  const parts: BlobPart[] = meta
    ? [new Uint8Array(buildId3Tag(meta)), ...mp3Parts]
    : mp3Parts;

  return { filename, parts };
}

/** Склеивает части MP3 в один Uint8Array (для упаковки в ZIP). */
function partsToBytes(parts: BlobPart[]): Uint8Array {
  const arrs = parts as Uint8Array[];
  const len = arrs.reduce((s, a) => s + a.byteLength, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.byteLength; }
  return out;
}

// ── Кнопка скачивания трека + инлайн-статус ─────────────────────────────────────

/**
 * Создаёт кнопку «⬇» и элемент статуса (idle/loading/done/error) с кликом через
 * семафор. Трек резолвится в момент клика (`getEntry`) — нужно для плеера, где
 * текущая запись меняется. Прогресс дублируется в глобальный центр загрузок.
 */
function createDownloadControl(getEntry: () => TrackEntry | null, btnClass: string): {
  btn: HTMLButtonElement;
  status: HTMLElement;
} {
  const baseCls = `${btnClass} vkify-dl-btn`;

  const status = document.createElement('div');
  status.className = 'vkify-dl-status';
  status.setAttribute(STATUS_ATTR, '');
  const statusDot = document.createElement('span');
  statusDot.className = 'vkify-dl-status-dot';
  const statusText = document.createElement('span');
  statusText.className = 'vkify-dl-status-text';
  status.append(statusDot, statusText);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = baseCls;
  btn.setAttribute(BUTTON_ATTR, '');
  btn.setAttribute('aria-label', 'Скачать MP3');
  attachBrandTooltip(btn, 'Скачать MP3');

  const iconBox = document.createElement('div');
  iconBox.className = 'audio_row__icon';
  const icDl = document.createElement('span');
  icDl.className = 'vkify-dl-ic-dl';
  icDl.appendChild(buildDownloadIconSvg(20));
  const icSpin = document.createElement('span');
  icSpin.className = 'vkify-dl-ic-spin';
  const icOk = document.createElement('span');
  icOk.className = 'vkify-dl-ic-ok';
  icOk.textContent = '✓';
  const icErr = document.createElement('span');
  icErr.className = 'vkify-dl-ic-err';
  icErr.textContent = '✕';
  iconBox.append(icDl, icSpin, icOk, icErr);
  btn.appendChild(iconBox);

  let resetTimer: number | undefined;
  const setStatus = (text: string, kind: 'load' | 'done' | 'err'): void => {
    statusText.textContent = text;
    status.className = `vkify-dl-status is-visible s-${kind}`;
  };
  const setIdle    = (): void => { status.className = 'vkify-dl-status'; btn.className = baseCls; };
  const setLoading = (t: string): void => { window.clearTimeout(resetTimer); btn.className = `${baseCls} is-loading`; setStatus(t, 'load'); };
  const setDone    = (t: string): void => { btn.className = `${baseCls} is-done`;  setStatus(t, 'done'); resetTimer = window.setTimeout(setIdle, 4000); };
  const setError   = (t: string): void => { btn.className = `${baseCls} is-error`; setStatus(t, 'err');  resetTimer = window.setTimeout(setIdle, 6000); };

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (btn.classList.contains('is-loading')) return;

    const entry = getEntry();
    if (!entry) { setError('Нет трека'); return; }

    hideBrandTooltip();
    const jobId = entry.trackId;
    const jobTitle = entry.performer ? `${entry.performer} — ${entry.title}` : (entry.title || 'Трек');
    jobStart(jobId, jobTitle);
    const report = (t: string): void => { setLoading(t); jobUpdate(jobId, t); };

    report(activeDownloads >= MAX_CONCURRENT ? 'В очереди' : 'Получение ссылки');
    await acquireSlot();
    try {
      report('Получение ссылки');
      const { filename, parts } = await produceMp3(entry, report);
      report('Сохранение');
      triggerDownload(parts, `${filename}.mp3`);
      setDone('Готово');
      jobDone(jobId, 'Готово');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setError(msg);
      jobError(jobId, msg);
    } finally {
      releaseSlot();
    }
  });

  return { btn, status };
}

// ── Классический интерфейс (.audio_row[data-full-id]) ───────────────────────────

function injectClassicButton(row: Element, entry: TrackEntry): void {
  if (row.querySelector(`[${BUTTON_ATTR}]`)) return;
  const actions = findActionsContainer(row);
  if (!actions) return;

  const { btn, status } = createDownloadControl(() => entry, 'audio_row__action');

  // Статус — внутрь элемента длительности (наследует VK-поведение видимости).
  const duration =
    row.querySelector('._audio_row__duration') ?? row.querySelector('.audio_row__duration');
  if (duration) duration.appendChild(status);
  else (actions.closest('._audio_row__info') ?? actions.closest('.audio_row__info') ?? actions).appendChild(status);

  // Кнопка — перед «Ещё».
  const moreBtn = actions.querySelector('._audio_row__action_more') ?? actions.querySelector('.audio_row__action_more');
  if (moreBtn) actions.insertBefore(btn, moreBtn);
  else actions.appendChild(btn);
}

/** Трек из классической строки `.audio_row[data-full-id]`. */
function classicRowToEntry(row: Element): TrackEntry | null {
  const trackId = row.getAttribute('data-full-id') ?? '';
  if (!trackId) return null;
  const cached = trackCache.get(trackId);
  if (cached) return cached;
  const data = parseAudioData(row);
  if (!data) return null;
  const { title, performer, coverUrl } = extractMeta(row, data);
  const entry: TrackEntry = { trackId, title, performer, coverUrl, audioData: data };
  trackCache.set(trackId, entry);
  return entry;
}

function injectClassicButtons(): void {
  for (const row of findAudioRows()) {
    const entry = classicRowToEntry(row);
    if (entry) injectClassicButton(row, entry);
  }
}

// ── Новый VKUI-интерфейс ([class*="vkitAudioRow__root"]) ─────────────────────────

/** Достаёт трек из VKUI-строки. URL потом резолвится через reload_audios
 *  (минимальный audioData: [audio_id, owner_id]). */
function vkuiRowToEntry(row: Element): TrackEntry | null {
  const titleA = row.querySelector<HTMLAnchorElement>('a[data-testid="MusicTrackRow_Title"]');
  const m = (titleA?.getAttribute('href') ?? '').match(/audio(-?\d+)_(\d+)/);
  if (!m) return null;

  const trackId = `${m[1]}_${m[2]}`;
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  const title = titleA?.textContent?.trim() ?? '';
  const performer = Array.from(row.querySelectorAll('a[data-testid="MusicTrackRow_Authors"]'))
    .map(a => a.textContent?.trim()).filter(Boolean).join(', ');
  const coverUrl = row.querySelector<HTMLImageElement>('[data-testid="MusicTrackRow_PlaybackControls"] img')?.src ?? '';

  const entry: TrackEntry = {
    trackId, title, performer, coverUrl,
    audioData: [Number(m[2]), Number(m[1]), '', title, performer],
  };
  trackCache.set(trackId, entry);
  return entry;
}

function injectVkuiButtons(): void {
  for (const row of document.querySelectorAll('[class*="vkitAudioRow__root"]')) {
    if (row.querySelector(`[${BUTTON_ATTR}]`)) continue;

    const group = row.querySelector('[data-testid="audiorow-actions"] [role="group"]')
      ?? row.querySelector('[class*="vkitAudioRow__buttonGroup"]');
    if (!group) continue;

    const entry = vkuiRowToEntry(row);
    if (!entry) continue;

    // Берём класс и инлайн-размер у соседней нативной icon-кнопки → наша
    // выглядит идентично (классы VKUI хешированы и могут меняться).
    const sample = group.querySelector('button');
    const btnClass = (sample?.className ?? 'vkuiIconButton__host').replace(/\bvkify-dl-btn\b/, '').trim();
    const { btn, status } = createDownloadControl(() => entry, btnClass);
    if (sample?.getAttribute('style')) btn.setAttribute('style', sample.getAttribute('style')!);

    // Статус — рядом с длительностью (в .vkitAudioRow__after).
    const after = row.querySelector('[class*="vkitAudioRow__after"]')
      ?? row.querySelector('[data-testid="MusicTrackRow_Duration"]')?.parentElement
      ?? group;
    after.appendChild(status);

    // Кнопка — перед обёрткой кнопки-меню (последний элемент группы).
    const menuWrap = group.lastElementChild;
    if (menuWrap) group.insertBefore(btn, menuWrap);
    else group.appendChild(btn);
  }
}

// ── Кнопка в плеере (AudioPlayerBlock) ──────────────────────────────────────────

/** Текущий трек из плеера (запись меняется → резолвим на момент клика). */
function playerToEntry(): TrackEntry | null {
  const player = document.querySelector('.AudioPlayerBlock__root');
  if (!player) return null;
  const a = player.querySelector<HTMLAnchorElement>('a[data-testid="AudioPlayerBlock_AudioTitle"]');
  const m = (a?.getAttribute('href') ?? '').match(/audio(-?\d+)_(\d+)/);
  if (!m) return null;

  const trackId = `${m[1]}_${m[2]}`;
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  const title = a?.textContent?.trim() ?? '';
  const performer = player.querySelector('a[data-testid="AudioPlayerBlock_Authors"]')?.textContent?.trim() ?? '';
  const coverUrl = player.querySelector<HTMLImageElement>('[data-testid="AudioPlayerBlock_AudioCover"] img')?.src ?? '';
  const entry: TrackEntry = {
    trackId, title, performer, coverUrl,
    audioData: [Number(m[2]), Number(m[1]), '', title, performer],
  };
  trackCache.set(trackId, entry);
  return entry;
}

function injectPlayerButton(): void {
  // Класс контейнера хеширован (…__audioButtons--XXXX) → ищем по подстроке.
  const group = document.querySelector('[class*="vkitAudioPlayerPlaybackBody__audioButtons"] [role="group"]');
  if (!group || group.querySelector(`[${PLAYER_ATTR}]`)) return;

  const sample = group.querySelector('button');
  const btnClass = (sample?.className ?? 'vkuiIconButton__host').replace(/\bvkify-dl-btn\b/, '').trim();
  const { btn } = createDownloadControl(() => playerToEntry(), btnClass);
  btn.setAttribute(PLAYER_ATTR, '');
  if (sample?.getAttribute('style')) btn.setAttribute('style', sample.getAttribute('style')!);
  group.appendChild(btn);
}

// ── Скачивание целого альбома в ZIP (модалка MusicPlaylistModal) ─────────────────

/** Полный список треков плейлиста через инжектированный al_audio.php. */
function requestPlaylist(ownerId: string, playlistId: string, accessHash: string): Promise<unknown[][]> {
  return new Promise((resolve) => {
    const requestId = `pl_${++reqCounter}`;
    const handler = (e: Event): void => {
      const d = (e as CustomEvent<{ requestId: string; list: unknown[][] }>).detail;
      if (d.requestId !== requestId) return;
      window.removeEventListener('vkify:audio:playlist-response', handler);
      resolve(Array.isArray(d.list) ? d.list : []);
    };
    window.addEventListener('vkify:audio:playlist-response', handler);
    setTimeout(() => { window.removeEventListener('vkify:audio:playlist-response', handler); resolve([]); }, 30000);
    dispatchPageEvent('vkify:audio:get-playlist', { requestId, ownerId, playlistId, accessHash });
  });
}

/** VK audio-кортеж → TrackEntry (URL потом резолвится в produceMp3). */
function tupleToEntry(t: unknown[]): TrackEntry | null {
  if (!Array.isArray(t) || typeof t[0] !== 'number' || typeof t[1] !== 'number') return null;
  const trackId = `${t[1]}_${t[0]}`;
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  let coverUrl = '';
  const raw = t[14];
  if (typeof raw === 'string') {
    const f = raw.split(',')[0]?.trim();
    if (f?.startsWith('http')) coverUrl = f;
  }
  const entry: TrackEntry = {
    trackId, title: String(t[3] ?? ''), performer: String(t[4] ?? ''), coverUrl, audioData: t,
  };
  trackCache.set(trackId, entry);
  return entry;
}

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
function injectAlbumButton(): void {
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

/** Кнопка «Скачать всё» — в панели действий вкладок раздела «Моя музыка». */
function injectAllAudiosButton(): void {
  const actions = document.querySelector<HTMLElement>('.audio_section_tabs_actions');
  const onMyMusic = /\/audios-?\d+/.test(window.location.pathname)
    && (document.querySelector('.ui_tabs_header .ui_tab_sel')?.getAttribute('href')?.includes('section=all') ?? false);

  const existing = actions?.querySelector(`[${ALL_ATTR}]`) ?? null;
  // Показываем только на «Моя музыка»; на других вкладках убираем.
  if (!actions || !onMyMusic) { existing?.remove(); return; }
  if (existing) return;

  const btn = createBrandButton('Скачать всё', 'Скачать все треки пользователя в ZIP');
  btn.setAttribute(ALL_ATTR, '');
  btn.style.marginLeft = '14px';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void downloadAllAudios(btn);
  });
  actions.insertBefore(btn, actions.firstChild);
}

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

// ── HLS → MP3 (возвращает MP3-фреймы) ──────────────────────────────────────────

async function fetchAndEncode(
  m3u8url: string,
  bitrate: number,
  onProgress: (s: string) => void,
): Promise<BlobPart[]> {
  if (!Hls.isSupported()) throw new Error('HLS не поддерживается');

  onProgress('Подключение');

  const audio = document.createElement('audio');
  audio.muted = true;
  audio.style.cssText = 'position:fixed;left:-9999px;opacity:0;pointer-events:none';
  document.body.appendChild(audio);

  const hls = new Hls({
    enableWorker: false,
    debug: false,
    maxBufferLength: 9999,
    maxMaxBufferLength: 9999,
    maxBufferSize: 0,
    backBufferLength: 0,
  });

  let totalFrags = 0;
  let loadedFrags = 0;
  const audioChunks: Uint8Array[] = [];
  const mainChunks:  Uint8Array[] = [];

  hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
    totalFrags = data.details.fragments.length;
    onProgress(`Сегменты 0 / ${totalFrags}`);
  });

  hls.on(Hls.Events.BUFFER_APPENDING, (_, data) => {
    const copy = data.data.slice();
    if (data.type === 'audio') {
      audioChunks.push(copy);
    } else if (data.type === 'audiovideo' || (data.type as string) === 'main') {
      mainChunks.push(copy);
    }
  });

  await new Promise<void>((resolve) => {
    hls.on(Hls.Events.FRAG_LOADED, () => {
      loadedFrags++;
      onProgress(`Сегменты ${loadedFrags} / ${totalFrags}`);
    });
    hls.on(Hls.Events.BUFFER_EOS, () => setTimeout(resolve, 150));
    hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) resolve(); });
    audio.addEventListener('ended', () => resolve());

    hls.loadSource(m3u8url);
    hls.attachMedia(audio);
    audio.addEventListener('canplay', () => {
      audio.playbackRate = 16;
      void audio.play().catch(() => {});
    });
    setTimeout(resolve, 5 * 60 * 1000);
  });

  hls.destroy();
  audio.remove();

  const chunks = audioChunks.length > 0 ? audioChunks : mainChunks;
  if (chunks.length === 0) throw new Error('Аудиоданные не получены');

  onProgress('Декодирование');
  const totalLen = chunks.reduce((s, c) => s + c.byteLength, 0);
  const combined = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { combined.set(c, off); off += c.byteLength; }

  const ctx = new AudioContext();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(combined.buffer.slice(0));
  } finally {
    void ctx.close();
  }

  const channels   = Math.min(buf.numberOfChannels, 2) as 1 | 2;
  const sampleRate = buf.sampleRate;
  const encoder    = new Mp3Encoder(channels, sampleRate, bitrate);

  const leftF  = buf.getChannelData(0);
  const rightF = channels > 1 ? buf.getChannelData(1) : leftF;
  const left   = floatToInt16(leftF);
  const right  = floatToInt16(rightF);

  const FRAME = 1152;
  const mp3Parts: BlobPart[] = [];

  const pushPart = (part: Uint8Array): void => {
    if (!part.length) return;
    const ab = part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer;
    mp3Parts.push(new Uint8Array(ab));
  };

  // Уступаем main-thread каждые ~0.3 с аудио, чтобы не морозить VK при
  // кодировании (особенно когда в очереди несколько треков).
  const yieldEvery = Math.max(8, Math.round(sampleRate * 0.3 / FRAME));
  let frameCount = 0;

  for (let i = 0; i < left.length; i += FRAME) {
    pushPart(encoder.encodeBuffer(left.subarray(i, i + FRAME), right.subarray(i, i + FRAME)));
    if (++frameCount % yieldEvery === 0) {
      const pct = Math.round(i / left.length * 100);
      onProgress(`Конвертация ${pct}%`);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  pushPart(encoder.flush());

  return mp3Parts;
}

function triggerDownload(parts: BlobPart[], filename: string): void {
  const blob    = new Blob(parts, { type: 'audio/mpeg' });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

function floatToInt16(f32: Float32Array): Int16Array {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return i16;
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
        activeDownloads = 0;
        waitQueue.length = 0;
      },
    },
  };
}
