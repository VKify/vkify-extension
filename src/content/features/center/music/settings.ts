/** Настройки скачивания (битрейт / формат имени / ID3 / текст) + имя файла. */

import { sanitizeFilename } from '../_shared/index.js';
import type { DownloadSettings } from './types.js';

export async function getDownloadSettings(): Promise<DownloadSettings> {
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

export function buildFilename(performer: string, title: string, format: string): string {
  switch (format) {
    case 'title_artist': return sanitizeFilename(`${title} - ${performer}`);
    case 'title':        return sanitizeFilename(title || performer);
    default:             return sanitizeFilename(`${performer} - ${title}`);
  }
}
