/** Качества видео: цвета, порядок отображения и типы прямых URL'ов. */

/** Цвет «точки» у каждого качества в пикере. */
export const QUALITY_COLORS: Record<string, string> = {
  mp4_1080: '#a855f7',
  mp4_720:  '#3b82f6',
  mp4_480:  '#06b6d4',
  mp4_360:  '#10b981',
  mp4_240:  '#9ca3af',
};

/** Порядок отображения качеств в пикере (от высшего к низшему). */
export const VIDEO_QUALITIES = [
  { key: 'mp4_1080' as const, label: '1080p' },
  { key: 'mp4_720'  as const, label: '720p'  },
  { key: 'mp4_480'  as const, label: '480p'  },
  { key: 'mp4_360'  as const, label: '360p'  },
  { key: 'mp4_240'  as const, label: '240p'  },
];

export type VideoQualityKey = typeof VIDEO_QUALITIES[number]['key'];

/** Поля прямых URL'ов из ответа video.get / stories.getById. */
export interface VideoQualityFiles {
  mp4_1080?: string;
  mp4_720?:  string;
  mp4_480?:  string;
  mp4_360?:  string;
  mp4_240?:  string;
}
