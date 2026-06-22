/** Вкладки выбора фона (готовые пресеты / свой URL-файл). */
export const TABS = [
  { id: 'presets', label: '🎭 Готовые' },
  { id: 'custom', label: '📤 Свой' },
] as const;

/** Человекочитаемые названия типов фона для бейджа в шапке. */
export const TYPE_NAMES: Record<string, string> = {
  image: 'Изображение',
  video: 'Видео',
  embed: 'Видео (embed)',
  web: 'Веб-обои',
};

/** Названия платформ embed-видео (для подписи распознанного URL). */
export const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  vk: 'VK Video',
  vimeo: 'Vimeo',
  coub: 'Coub',
  dailymotion: 'Dailymotion',
  rutube: 'Rutube',
  twitch: 'Twitch',
};
