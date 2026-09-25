/** Типы ответа video.get. */

import type { VideoQualityFiles } from '../_shared/index.js';

export interface VideoItem {
  owner_id?: number;
  id?: number;
  title?: string;
  files?: VideoQualityFiles;
}
export interface VideoGetResponse { count: number; items: VideoItem[] }
