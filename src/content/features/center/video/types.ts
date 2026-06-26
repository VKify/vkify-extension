/** Типы ответа video.get. */

import type { VideoQualityFiles } from '../_shared/index.js';

export interface VideoItem { title?: string; files?: VideoQualityFiles }
export interface VideoGetResponse { count: number; items: VideoItem[] }
