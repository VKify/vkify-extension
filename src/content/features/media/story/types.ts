/** Типы ответа stories.getById. */

import type { VideoQualityFiles } from '../_shared.js';

export interface PhotoSize { url: string; width: number; type: string }

export interface StoryItem {
  id:        number;
  owner_id:  number;
  type:      'photo' | 'video';
  photo?:    { sizes: PhotoSize[] };
  video?:    { title?: string; files?: VideoQualityFiles };
}

export interface StoriesGetByIdResponse { count: number; items: StoryItem[] }
