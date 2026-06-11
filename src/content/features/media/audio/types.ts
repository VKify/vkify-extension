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
  filenameFormat: string;
  id3: boolean;
  lyrics: boolean;
}
