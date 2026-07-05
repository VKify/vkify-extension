/** Общие типы аудио-скачивания. */

export interface TrackEntry {
  trackId: string;
  title: string;
  performer: string;
  coverUrl: string;
  audioData: unknown[];
  cachedUrl?: string;
}

export interface DownloadSettings {
  bitrate: number;
  /** 'mp3' — конвертация lamejs; 'original' — AAC без перекодирования (.m4a). */
  format: 'mp3' | 'original';
  filenameFormat: string;
  id3: boolean;
  lyrics: boolean;
}
