/** Минимальный DOM-слой: строки, ID трека и место вставки кнопки. */

import type { TrackEntry } from './types.js';
import { queryAll, safeQuerySelector } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';

export const trackCache = new Map<string, TrackEntry>();
const TRACK_ID_RE = /(?:audio)?(-?\d+)_(\d+)/;

export function findTrackRoots(): Element[] {
  const roots = queryAll(SELECTORS.music.trackRoot);
  return roots.filter(root => !roots.some(other => other !== root && other.contains(root)
    && extractTrackId(other) === extractTrackId(root)));
}

export function extractTrackId(root: Element): string | null {
  const attrNode = root.matches('[data-audio-id]')
    ? root
    : root.closest(SELECTORS.music.audioIdAttr) ?? root.querySelector(SELECTORS.music.audioIdAttr);
  const candidates = [
    attrNode?.getAttribute('data-audio-id'),
    root.getAttribute('data-full-id'),
    safeQuerySelector<HTMLAnchorElement>(SELECTORS.music.vkuiTitle, root)?.getAttribute('href'),
  ];
  for (const value of candidates) {
    const match = value?.match(TRACK_ID_RE);
    if (match) return `${match[1]}_${match[2]}`;
  }
  for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'href' || attr.name.startsWith('data-')) {
        const match = attr.value.match(TRACK_ID_RE);
        if (match) return `${match[1]}_${match[2]}`;
      }
    }
  }
  return null;
}

export function findActionsGroup(root: Element): Element | null {
  const exact = safeQuerySelector(SELECTORS.music.rowActions, root);
  if (exact) return exact;
  return Array.from(root.querySelectorAll('[role="group"]')).find(group => group.querySelector('button')) ?? null;
}

export function findAudioRows(): Element[] {
  return queryAll(SELECTORS.music.rowWithId);
}
export const findActionsContainer = findActionsGroup;

function fallbackEntry(root: Element): TrackEntry | null {
  const trackId = extractTrackId(root);
  if (!trackId) return null;
  const cached = trackCache.get(trackId);
  if (cached) return cached;
  const [owner, id] = trackId.split('_');
  const dataRaw = root.getAttribute('data-audio');
  let data: unknown[] = [Number(id), Number(owner)];
  if (dataRaw) {
    try { const parsed = JSON.parse(dataRaw) as unknown; if (Array.isArray(parsed)) data = parsed; } catch { /* fallback */ }
  }
  const entry: TrackEntry = {
    trackId,
    title: safeQuerySelector<HTMLElement>(SELECTORS.music.vkuiTitle, root)?.textContent?.trim()
      || safeQuerySelector<HTMLElement>(SELECTORS.music.rowTitle, root)?.textContent?.trim()
      || String(data[3] ?? ''),
    performer: queryAll<HTMLElement>(SELECTORS.music.vkuiAuthors, root)
      .map(el => el.textContent?.trim()).filter(Boolean).join(', ')
      || safeQuerySelector<HTMLElement>(SELECTORS.music.rowPerformer, root)?.textContent?.trim()
      || String(data[4] ?? ''),
    coverUrl: safeQuerySelector<HTMLImageElement>(SELECTORS.music.vkuiCover, root)?.src
      || safeQuerySelector<HTMLImageElement>(SELECTORS.music.rowCover, root)?.src
      || (typeof data[14] === 'string' ? data[14].split(',')[0] : ''),
    audioData: data,
  };
  trackCache.set(trackId, entry);
  return entry;
}

export const classicRowToEntry = fallbackEntry;
export const vkuiRowToEntry = fallbackEntry;

export function playerToEntry(): TrackEntry | null {
  const player = safeQuerySelector(SELECTORS.music.player);
  if (!player) return null;
  const title = safeQuerySelector<HTMLAnchorElement>(SELECTORS.music.playerTitle, player);
  const match = title?.getAttribute('href')?.match(TRACK_ID_RE);
  if (!match) return null;
  const trackId = `${match[1]}_${match[2]}`;
  return {
    trackId,
    title: title?.textContent?.trim() ?? '',
    performer: safeQuerySelector<HTMLElement>(SELECTORS.music.playerAuthors, player)?.textContent?.trim() ?? '',
    coverUrl: safeQuerySelector<HTMLImageElement>(SELECTORS.music.playerCover, player)?.src ?? '',
    audioData: [Number(match[2]), Number(match[1])],
  };
}

export function tupleToEntry(tuple: unknown[]): TrackEntry | null {
  if (!Array.isArray(tuple) || !Number.isFinite(Number(tuple[0])) || !Number.isFinite(Number(tuple[1]))) return null;
  const trackId = `${String(tuple[1])}_${String(tuple[0])}`;
  const cached = trackCache.get(trackId);
  if (cached) return cached;
  const cover = typeof tuple[14] === 'string' ? tuple[14].split(',')[0]?.trim() ?? '' : '';
  const entry: TrackEntry = {
    trackId,
    title: String(tuple[3] ?? ''), performer: String(tuple[4] ?? ''),
    coverUrl: cover.startsWith('http') ? cover : '', audioData: tuple,
    cachedUrl: typeof tuple[2] === 'string' && !tuple[2].includes('audio_api_unavailable') ? tuple[2] : undefined,
  };
  trackCache.set(trackId, entry);
  return entry;
}
