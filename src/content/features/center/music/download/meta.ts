/** ID3-метаданные: обложка (через background) и текст песни (Genius). */

import { buildId3Tag, type Id3Meta } from './id3.js';
import type { TrackEntry, DownloadSettings } from './types.js';

export { buildId3Tag, type Id3Meta };

export async function fetchCover(url: string): Promise<{ data: Uint8Array; mime: string } | null> {
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

export async function fetchLyrics(artist: string, title: string): Promise<string> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'AUDIO_FETCH_LYRICS', artist, title }) as
      { success: boolean; lyrics?: string } | undefined;
    return resp?.success && resp.lyrics ? resp.lyrics : '';
  } catch { return ''; }
}

/** Собирает ID3-метаданные (обложка/текст тянутся параллельно). */
export async function buildMeta(entry: TrackEntry, cfg: DownloadSettings): Promise<Id3Meta | null> {
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
