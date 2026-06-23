/**
 * Чтение треков из DOM VK: классические строки `.audio_row`, новые VKUI-строки,
 * плеер и кортежи al_audio.php. Локальный кеш треков по trackId.
 *
 * Migrated to DOMObserver + selectors: все VK-селекторы вынесены в
 * SELECTORS.music и читаются через safeQuerySelector/queryAll.
 */

import type { TrackEntry } from './types.js';
import { queryAll, safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';

/** Локальный кеш треков (общий для всех источников). */
export const trackCache = new Map<string, TrackEntry>();

export function findAudioRows(): Element[] {
  return queryAll(SELECTORS.music.rowWithId);
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
  const performer = safeQuerySelector<HTMLElement>(SELECTORS.music.rowPerformer, row)
    ?.textContent?.trim() || String(data[4] ?? '');

  const title = safeQuerySelector<HTMLElement>(SELECTORS.music.rowTitle, row)
    ?.textContent?.trim() || String(data[3] ?? '');

  return { title, performer, coverUrl: extractCoverUrl(row, data) };
}

/** URL обложки трека: сперва из <img> в строке, иначе из data-audio[14]. */
function extractCoverUrl(row: Element, data: unknown[]): string {
  const img = safeQuerySelector<HTMLImageElement>(SELECTORS.music.rowCover, row);
  if (img?.src?.startsWith('http')) return img.src;

  const raw = data[14];
  if (typeof raw === 'string') {
    const first = raw.split(',')[0]?.trim();
    if (first?.startsWith('http')) return first;
  }
  return '';
}

/** Находит место вставки кнопки — внутри нативного контейнера `._audio_row__actions`. */
export function findActionsContainer(row: Element): Element | null {
  return safeQuerySelector(SELECTORS.music.rowActions, row);
}

/** Трек из классической строки `.audio_row[data-full-id]`. */
export function classicRowToEntry(row: Element): TrackEntry | null {
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

/** Достаёт трек из VKUI-строки. URL потом резолвится через reload_audios
 *  (минимальный audioData: [audio_id, owner_id]). */
export function vkuiRowToEntry(row: Element): TrackEntry | null {
  const titleA = safeQuerySelector<HTMLAnchorElement>(SELECTORS.music.vkuiTitle, row);
  const m = (titleA?.getAttribute('href') ?? '').match(/audio(-?\d+)_(\d+)/);
  if (!m) return null;

  const trackId = `${m[1]}_${m[2]}`;
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  const title = titleA?.textContent?.trim() ?? '';
  const performer = queryAll<HTMLElement>(SELECTORS.music.vkuiAuthors, row)
    .map(a => a.textContent?.trim()).filter(Boolean).join(', ');
  const coverUrl = safeQuerySelector<HTMLImageElement>(SELECTORS.music.vkuiCover, row)?.src ?? '';

  const entry: TrackEntry = {
    trackId, title, performer, coverUrl,
    audioData: [Number(m[2]), Number(m[1]), '', title, performer],
  };
  trackCache.set(trackId, entry);
  return entry;
}

/** Текущий трек из плеера (запись меняется → резолвим на момент клика). */
export function playerToEntry(): TrackEntry | null {
  const player = safeQuerySelector(SELECTORS.music.player);
  if (!player) return null;
  const a = safeQuerySelector<HTMLAnchorElement>(SELECTORS.music.playerTitle, player);
  const m = (a?.getAttribute('href') ?? '').match(/audio(-?\d+)_(\d+)/);
  if (!m) return null;

  const trackId = `${m[1]}_${m[2]}`;
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  const title = a?.textContent?.trim() ?? '';
  const performer = safeQuerySelector<HTMLElement>(SELECTORS.music.playerAuthors, player)?.textContent?.trim() ?? '';
  const coverUrl = safeQuerySelector<HTMLImageElement>(SELECTORS.music.playerCover, player)?.src ?? '';
  const entry: TrackEntry = {
    trackId, title, performer, coverUrl,
    audioData: [Number(m[2]), Number(m[1]), '', title, performer],
  };
  trackCache.set(trackId, entry);
  return entry;
}

/** VK audio-кортеж → TrackEntry (URL потом резолвится в produceMp3). */
export function tupleToEntry(t: unknown[]): TrackEntry | null {
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
