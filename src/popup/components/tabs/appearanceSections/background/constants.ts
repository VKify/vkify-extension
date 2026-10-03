/** Коллекции обоев, свой фон, расписание и настройка отображения. */
export const TABS = [
  { id: 'photos', label: 'Photo wallpapers', iconId: 'photos' },
  { id: 'videos', label: 'Video wallpapers', iconId: 'videos' },
  { id: 'custom', label: 'Custom', iconId: 'custom' },
  { id: 'schedule', label: 'Schedule', iconId: 'schedule' },
  { id: 'settings', label: 'Settings', iconId: 'settings' },
] as const;

/** Человекочитаемые названия типов фона для бейджа в шапке. */
export const TYPE_NAMES: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  embed: 'Video (embed)',
  web: 'Web wallpaper',
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
