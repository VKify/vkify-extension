/** Общие типы аудио-скачивания. */

export interface TrackEntry {
  trackId: string;
  title: string;
  performer: string;
  coverUrl: string;
  audioData: unknown[];
  cachedUrl?: string;
}

/** Полные данные трека, полученные из `reload_audios`, а не из DOM. */
export interface TrackInfo {
  trackId: string;
  title: string;
  performer: string;
  coverUrl: string;
  duration?: number;
  url: string;
  audioData?: unknown[];
}

export interface DownloadSettings {
  bitrate: number;
  /** 'mp3' — конвертация lamejs; 'original' — AAC без перекодирования (.m4a). */
  format: 'mp3' | 'original';
  filenameFormat: string;
  id3: boolean;
  lyrics: boolean;
}
