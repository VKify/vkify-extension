import { siteUrl } from '../../shared/constants/site.js';

export interface Theme {
  id: string;
  name: string;
  color: string;
  accent: string;
  category: string;
}

export interface ThemeCategory {
  id: string;
  name: string;
  icon: string;
}

export interface DisplayMode {
  id: string;
  title: string;
  description: string;
  iconId: string;
  iconColor: string;
}

export interface VisualFilter {
  id: string;
  title: string;
  emoji: string;
  description: string;
}

export interface BackgroundSetting {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
  icon?: string;
}

export interface BackgroundPosition {
  id: string;
  name: string;
  value: string;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  icon: string;
  settings: Record<string, number | undefined>;
}

export interface WallpaperPreset {
  id: string;
  name: string;
  type?: 'image' | 'video' | 'embed' | 'web';
  url?: string;
  value?: string;
  preview: string;
  category?: string;
}

export interface Font {
  id: string;
  name: string;
  value: string;
  category: string;
  google?: string;
  popular?: boolean;
  stylish?: boolean;
  decorative?: boolean;
  serif?: boolean;
  mono?: boolean;
}

export interface FontSizePreset {
  id: string;
  name: string;
  value: number;
}

export interface FontCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const THEMES: readonly Theme[] = Object.freeze([
  { id: 'default', name: 'По умолчанию', color: '', accent: '', category: 'standard' },

  { id: 'github-dark', name: 'GitHub Dark', color: '#0d1117', accent: '#58a6ff', category: 'classic' },
  { id: 'vscode-dark', name: 'VS Code', color: '#1e1e1e', accent: '#007acc', category: 'classic' },
  { id: 'one-dark', name: 'One Dark', color: '#282c34', accent: '#61afef', category: 'classic' },
  { id: 'dracula', name: 'Dracula', color: '#282a36', accent: '#bd93f9', category: 'classic' },
  { id: 'monokai', name: 'Monokai', color: '#272822', accent: '#f92672', category: 'classic' },
  { id: 'nord', name: 'Nord', color: '#2e3440', accent: '#88c0d0', category: 'classic' },
  { id: 'tokyo-night', name: 'Tokyo Night', color: '#1a1b26', accent: '#7aa2f7', category: 'classic' },
  { id: 'material', name: 'Material', color: '#212121', accent: '#82aaff', category: 'classic' },
  { id: 'atom-one', name: 'Atom One Dark', color: '#21252b', accent: '#528bff', category: 'classic' },
  { id: 'sublime', name: 'Sublime Monokai', color: '#272822', accent: '#66d9ef', category: 'classic' },

  { id: 'mocha', name: 'Catppuccin Mocha', color: '#1e1e2e', accent: '#cba6f7', category: 'soft' },
  { id: 'macchiato', name: 'Catppuccin Macchiato', color: '#24273a', accent: '#c6a0f6', category: 'soft' },
  { id: 'frappe', name: 'Catppuccin Frappé', color: '#303446', accent: '#ca9ee6', category: 'soft' },
  { id: 'rose-pine', name: 'Rosé Pine', color: '#191724', accent: '#ebbcba', category: 'soft' },
  { id: 'rose-pine-moon', name: 'Rosé Pine Moon', color: '#232136', accent: '#ea9a97', category: 'soft' },
  { id: 'gruvbox', name: 'Gruvbox', color: '#282828', accent: '#fabd2f', category: 'soft' },
  { id: 'solarized', name: 'Solarized Dark', color: '#002b36', accent: '#268bd2', category: 'soft' },
  { id: 'everforest', name: 'Everforest', color: '#2d353b', accent: '#a7c080', category: 'soft' },
  { id: 'kanagawa', name: 'Kanagawa', color: '#1f1f28', accent: '#7e9cd8', category: 'soft' },
  { id: 'gruvbox-material', name: 'Gruvbox Material', color: '#1d2021', accent: '#d8a657', category: 'soft' },
  { id: 'seoul256', name: 'Seoul256', color: '#3a3a3a', accent: '#87afaf', category: 'soft' },
  { id: 'tender', name: 'Tender', color: '#282828', accent: '#b3deef', category: 'soft' },

  { id: 'amoled-white', name: 'AMOLED', color: '#000000', accent: '#ffffff', category: 'amoled' },
  { id: 'amoled-blue', name: 'AMOLED Blue', color: '#000000', accent: '#0077ff', category: 'amoled' },
  { id: 'amoled-purple', name: 'AMOLED Purple', color: '#000000', accent: '#a855f7', category: 'amoled' },
  { id: 'amoled-green', name: 'AMOLED Green', color: '#000000', accent: '#22c55e', category: 'amoled' },
  { id: 'amoled-red', name: 'AMOLED Red', color: '#000000', accent: '#ef4444', category: 'amoled' },
  { id: 'amoled-orange', name: 'AMOLED Orange', color: '#000000', accent: '#f97316', category: 'amoled' },
  { id: 'midnight', name: 'Midnight', color: '#0a0a0f', accent: '#6366f1', category: 'amoled' },
  { id: 'amoled-cyan', name: 'AMOLED Cyan', color: '#000000', accent: '#06b6d4', category: 'amoled' },
  { id: 'amoled-pink', name: 'AMOLED Pink', color: '#000000', accent: '#ec4899', category: 'amoled' },
  { id: 'amoled-gold', name: 'AMOLED Gold', color: '#000000', accent: '#fbbf24', category: 'amoled' },

  { id: 'night-owl', name: 'Night Owl', color: '#011627', accent: '#7fdbca', category: 'colored' },
  { id: 'cobalt2', name: 'Cobalt2', color: '#193549', accent: '#ffc600', category: 'colored' },
  { id: 'synthwave', name: 'Synthwave', color: '#262335', accent: '#ff7edb', category: 'colored' },
  { id: 'palenight', name: 'Palenight', color: '#292d3e', accent: '#c792ea', category: 'colored' },
  { id: 'ayu-dark', name: 'Ayu Dark', color: '#0a0e14', accent: '#ffb454', category: 'colored' },
  { id: 'ayu-mirage', name: 'Ayu Mirage', color: '#1f2430', accent: '#ffcc66', category: 'colored' },
  { id: 'shades-of-purple', name: 'Shades of Purple', color: '#2d2b55', accent: '#fad000', category: 'colored' },
  { id: 'horizon', name: 'Horizon', color: '#1c1e26', accent: '#e95678', category: 'colored' },
  { id: 'oceanic', name: 'Oceanic Next', color: '#1b2b34', accent: '#6699cc', category: 'colored' },
  { id: 'moonlight', name: 'Moonlight II', color: '#212337', accent: '#82aaff', category: 'colored' },
  { id: 'city-lights', name: 'City Lights', color: '#1d252c', accent: '#5ec4ff', category: 'colored' },

  { id: 'neon-pink', name: 'Neon Pink', color: '#1a0a1f', accent: '#ff00ff', category: 'neon' },
  { id: 'neon-cyan', name: 'Neon Cyan', color: '#0a1a1f', accent: '#00ffff', category: 'neon' },
  { id: 'neon-green', name: 'Neon Green', color: '#0f1a0a', accent: '#39ff14', category: 'neon' },
  { id: 'cyberpunk', name: 'Cyberpunk', color: '#0d0221', accent: '#f72585', category: 'neon' },
  { id: 'outrun', name: 'Outrun', color: '#2b1b3d', accent: '#f233c6', category: 'neon' },
  { id: 'vapor', name: 'Vaporwave', color: '#1a0933', accent: '#ff71ce', category: 'neon' },

  { id: 'forest', name: 'Forest', color: '#1a2421', accent: '#5fb381', category: 'nature' },
  { id: 'ocean', name: 'Ocean Deep', color: '#0c1e2e', accent: '#4a90e2', category: 'nature' },
  { id: 'sunset', name: 'Sunset', color: '#2a1a1f', accent: '#ff6b6b', category: 'nature' },
  { id: 'aurora', name: 'Aurora', color: '#0e1c26', accent: '#00d9ff', category: 'nature' },
  { id: 'desert', name: 'Desert Night', color: '#1f1a14', accent: '#e6a157', category: 'nature' },
  { id: 'sakura', name: 'Sakura', color: '#2a1f28', accent: '#ffb7d5', category: 'nature' },

  { id: 'minimal-gray', name: 'Minimal Gray', color: '#1a1a1a', accent: '#e0e0e0', category: 'minimal' },
  { id: 'minimal-slate', name: 'Minimal Slate', color: '#1e293b', accent: '#94a3b8', category: 'minimal' },
  { id: 'minimal-zinc', name: 'Minimal Zinc', color: '#18181b', accent: '#a1a1aa', category: 'minimal' },
  { id: 'monochrome', name: 'Monochrome', color: '#0f0f0f', accent: '#d4d4d4', category: 'minimal' },

  { id: 'terminal-green', name: 'Terminal Green', color: '#0c0c0c', accent: '#33ff33', category: 'retro' },
  { id: 'terminal-amber', name: 'Terminal Amber', color: '#0c0c0c', accent: '#ffb000', category: 'retro' },
  { id: 'commodore-64', name: 'Commodore 64', color: '#3e31a2', accent: '#7a71f6', category: 'retro' },
  { id: 'apple-ii', name: 'Apple II', color: '#000000', accent: '#00ff00', category: 'retro' },
  { id: 'dos', name: 'MS-DOS', color: '#000000', accent: '#00aaaa', category: 'retro' },

  { id: 'warm-coffee', name: 'Coffee', color: '#1a1410', accent: '#c7956d', category: 'warm' },
  { id: 'warm-ember', name: 'Ember', color: '#1f1410', accent: '#ff6b35', category: 'warm' },
  { id: 'warm-honey', name: 'Honey', color: '#1a1510', accent: '#ffa94d', category: 'warm' },
  { id: 'warm-autumn', name: 'Autumn', color: '#1f1712', accent: '#d4722c', category: 'warm' },

  { id: 'cool-ice', name: 'Ice', color: '#0f1419', accent: '#95e1d3', category: 'cool' },
  { id: 'cool-arctic', name: 'Arctic', color: '#0e1621', accent: '#88c0d0', category: 'cool' },
  { id: 'cool-frost', name: 'Frost', color: '#101820', accent: '#a8dadc', category: 'cool' },
  { id: 'cool-winter', name: 'Winter Night', color: '#0d1b2a', accent: '#8ecae6', category: 'cool' },
]);

export const THEME_CATEGORIES: readonly ThemeCategory[] = Object.freeze([
  { id: 'all', name: 'Все', icon: '🎨' },
  { id: 'classic', name: 'Классика', icon: '📝' },
  { id: 'soft', name: 'Мягкие', icon: '🌸' },
  { id: 'amoled', name: 'AMOLED', icon: '🖤' },
  { id: 'colored', name: 'Цветные', icon: '🌈' },
  { id: 'neon', name: 'Неоновые', icon: '⚡' },
  { id: 'nature', name: 'Природа', icon: '🌿' },
  { id: 'minimal', name: 'Минимализм', icon: '◾' },
  { id: 'retro', name: 'Ретро', icon: '💾' },
  { id: 'warm', name: 'Тёплые', icon: '🔥' },
  { id: 'cool', name: 'Холодные', icon: '❄️' },
]);

export const DISPLAY_MODES: readonly DisplayMode[] = Object.freeze([
  { id: 'minimalistic_sidebar', title: 'Компактное меню', description: 'Узкая боковая панель с иконками', iconId: 'sidebar', iconColor: 'purple' },
  { id: 'fixed_sidebar', title: 'Фиксированное меню', description: 'Меню остаётся на месте при прокрутке', iconId: 'sidebar', iconColor: 'green' },
  { id: 'sidebar_with_background', title: 'Меню с фоном', description: 'Добавляет фон боковому меню', iconId: 'sidebar', iconColor: 'blue' },
  { id: 'collapse_search', title: 'Свернуть поиск', description: 'Поле поиска сворачивается в иконку', iconId: 'search', iconColor: 'orange' },
  { id: 'compact_spacing', title: 'Компактный режим', description: 'Убирает отступы между блоками страницы', iconId: 'rows', iconColor: 'cyan' },
]);

/**
 * Пункты левого меню ВК с их стабильными id (атрибут id у `<li>`: `l_pr`,
 * `l_msg`, …). Используется страницей «Пункты меню» (Вид → Макет) — тумблеры
 * управляют массивом `hidden_menu_items`. Группы повторяют разделители ВК.
 */
export interface MenuItem {
  id: string;
  name: string;
}

export interface MenuItemGroup {
  id: string;
  title: string;
  items: readonly MenuItem[];
  /**
   * Разделитель-линия, который в меню ВК стоит ПОСЛЕ этой группы. Скрывается так
   * же, как пункт (через `hidden_menu_items`), но на стороне content таргетится
   * по соседнему пункту (см. menu-items.ts), т.к. у `<div>`-разделителя нет id.
   */
  separatorAfter?: MenuItem;
}

export const MENU_ITEM_GROUPS: readonly MenuItemGroup[] = Object.freeze([
  {
    id: 'main',
    title: 'Основные',
    items: [
      { id: 'l_pr',       name: 'Профиль' },
      { id: 'l_nwsf',     name: 'Лента' },
      { id: 'l_msg',      name: 'Мессенджер' },
      { id: 'l_ca',       name: 'Звонки' },
      { id: 'l_fr',       name: 'Друзья' },
      { id: 'l_gr',       name: 'Сообщества' },
      { id: 'l_ph',       name: 'Фото' },
      { id: 'l_aud',      name: 'Музыка' },
      { id: 'l_vid',      name: 'Видео' },
      { id: 'l_svd',      name: 'Клипы' },
      { id: 'l_ap',       name: 'Игры' },
      { id: 'l_stickers', name: 'Стикеры' },
      { id: 'l_mk',       name: 'Маркет' },
    ],
    separatorAfter: { id: 'sep_main', name: 'Разделитель' },
  },
  {
    id: 'services',
    title: 'Сервисы',
    items: [
      { id: 'l_mini_apps', name: 'Сервисы' },
      { id: 'l_buy_votes', name: 'Голоса' },
    ],
    separatorAfter: { id: 'sep_services', name: 'Разделитель' },
  },
  {
    id: 'personal',
    title: 'Личное',
    items: [
      { id: 'l_fav', name: 'Закладки' },
      { id: 'l_doc', name: 'Файлы' },
      { id: 'l_ads', name: 'Реклама' },
      { id: 'l_faq', name: 'Помощь' },
    ],
  },
]);

/** Плоский список всех управляемых id (пункты + разделители). */
export const MENU_ITEM_IDS: readonly string[] = Object.freeze(
  MENU_ITEM_GROUPS.flatMap((g) => [
    ...g.items.map((i) => i.id),
    ...(g.separatorAfter ? [g.separatorAfter.id] : []),
  ]),
);

export const VISUAL_FILTERS: readonly VisualFilter[] = Object.freeze([
  { id: 'filter_grayscale', title: 'Чёрно-белый', emoji: '⚫', description: 'Убрать все цвета' },
  { id: 'filter_sepia', title: 'Сепия', emoji: '🟤', description: 'Тёплый винтажный оттенок' },
  { id: 'filter_invert', title: 'Инверсия', emoji: '🔄', description: 'Инвертировать все цвета' },
  { id: 'filter_dim_images', title: 'Затемнить фото', emoji: '🌙', description: 'Приглушить яркость изображений' },
  { id: 'filter_low_brightness', title: 'Низкая яркость', emoji: '🔅', description: 'Снизить яркость страницы' },
  { id: 'filter_high_contrast', title: 'Высокий контраст', emoji: '◐', description: 'Увеличить контрастность' },
]);

export const BACKGROUND_SETTINGS: readonly BackgroundSetting[] = Object.freeze([
  { id: 'background_blur', label: 'Размытие', min: 0, max: 50, step: 1, unit: 'px', defaultValue: 8 },
  { id: 'background_dim', label: 'Затемнение', min: 0, max: 90, step: 5, unit: '%', defaultValue: 30 },
  { id: 'background_opacity', label: 'Прозрачность', min: 10, max: 100, step: 5, unit: '%', defaultValue: 100 },
  { id: 'background_scale', label: 'Масштаб', min: 70, max: 150, step: 5, unit: '%', defaultValue: 105 },
]);

export const BACKGROUND_FILTERS: readonly BackgroundSetting[] = Object.freeze([
  { id: 'background_brightness', label: 'Яркость', icon: '☀️', min: 50, max: 150, step: 5, unit: '%', defaultValue: 100 },
  { id: 'background_contrast', label: 'Контраст', icon: '◐', min: 50, max: 150, step: 5, unit: '%', defaultValue: 100 },
  { id: 'background_saturation', label: 'Насыщенность', icon: '🎨', min: 0, max: 200, step: 10, unit: '%', defaultValue: 100 },
  { id: 'background_hue_rotate', label: 'Оттенок', icon: '🌈', min: -180, max: 180, step: 15, unit: '°', defaultValue: 0 },
  { id: 'background_sepia', label: 'Сепия', icon: '📜', min: 0, max: 100, step: 10, unit: '%', defaultValue: 0 },
  { id: 'background_grayscale', label: 'Ч/Б', icon: '⬛', min: 0, max: 100, step: 10, unit: '%', defaultValue: 0 },
]);

export const BACKGROUND_EFFECTS: readonly BackgroundSetting[] = Object.freeze([
  { id: 'background_vignette', label: 'Виньетка', icon: '🔲', min: 0, max: 80, step: 10, unit: '%', defaultValue: 0 },
]);

export const BACKGROUND_POSITIONS: readonly BackgroundPosition[] = Object.freeze([
  { id: 'center', name: 'По центру', value: 'center' },
  { id: 'top', name: 'Сверху', value: 'top center' },
  { id: 'bottom', name: 'Снизу', value: 'bottom center' },
  { id: 'left', name: 'Слева', value: 'center left' },
  { id: 'right', name: 'Справа', value: 'center right' },
]);

export const BACKGROUND_SIZES: readonly BackgroundPosition[] = Object.freeze([
  { id: 'cover', name: 'Заполнить', value: 'cover' },
  { id: 'contain', name: 'Вместить', value: 'contain' },
  { id: 'auto', name: 'Оригинал', value: 'auto' },
  { id: 'stretch', name: 'Растянуть', value: '100% 100%' },
]);

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = Object.freeze([
  { id: 'clear', name: 'Чистый', icon: '✨', settings: { blur: 0, dim: 0, brightness: 100, contrast: 100, saturation: 100 } },
  { id: 'soft', name: 'Мягкий', icon: '☁️', settings: { blur: 15, dim: 20, brightness: 100, contrast: 100, saturation: 90 } },
  { id: 'dreamy', name: 'Мечта', icon: '💭', settings: { blur: 25, dim: 30, brightness: 110, contrast: 90, saturation: 80 } },
  { id: 'cinematic', name: 'Кино', icon: '🎬', settings: { blur: 5, dim: 40, brightness: 95, contrast: 115, saturation: 90, vignette: 30 } },
  { id: 'vintage', name: 'Винтаж', icon: '📷', settings: { blur: 2, dim: 15, brightness: 95, contrast: 105, saturation: 70, sepia: 30 } },
  { id: 'noir', name: 'Нуар', icon: '🖤', settings: { blur: 3, dim: 50, brightness: 90, contrast: 120, saturation: 0, grayscale: 100, vignette: 40 } },
  { id: 'vibrant', name: 'Яркий', icon: '🌟', settings: { blur: 8, dim: 10, brightness: 110, contrast: 110, saturation: 130 } },
  { id: 'dark', name: 'Тёмный', icon: '🌙', settings: { blur: 10, dim: 60, brightness: 80, contrast: 100, saturation: 80 } },
]);

export const VIDEO_SETTINGS = [
  { id: 'background_video_speed', label: 'Скорость', min: 25, max: 200, step: 25, defaultValue: 100, unit: '%' },
  { id: 'background_video_volume', label: 'Громкость', min: 0, max: 100, step: 5, defaultValue: 0, unit: '%' },
];

// Пресетные обои хостятся на сайте (vkify.ru/wallpapers/images/…), а не лежат
// статикой внутри расширения — это облегчает пакет и позволяет шарить такой фон
// по ссылке-теме (URL сайта доступен другим пользователям, в отличие от
// chrome-extension://). full — полное изображение для фона, thumb — превью.
const wp = (name: string): string => siteUrl(`/wallpapers/images/${name}.jpg`);

export const createPresetWallpapers = (): WallpaperPreset[] => [
  { id: 'image-1', name: 'Горы', type: 'image', value: wp('mountains'), preview: wp('mountains_thumb') },
  { id: 'image-2', name: 'Космос', type: 'image', value: wp('space'), preview: wp('space_thumb') },
  { id: 'image-3', name: 'Море', type: 'image', value: wp('sea'), preview: wp('sea_thumb') },
  { id: 'image-4', name: 'Лес', type: 'image', value: wp('forest'), preview: wp('forest_thumb') },
  { id: 'image-5', name: 'Город', type: 'image', value: wp('city'), preview: wp('city_thumb') },
  { id: 'image-6', name: 'Пустыня', type: 'image', value: wp('desert'), preview: wp('desert_thumb') },
];

export const findThemeById = (id: string): Theme => THEMES.find(t => t.id === id) || THEMES[0];
export const isDefaultTheme = (id?: string): boolean => !id || id === 'default';

export const FONTS: readonly Font[] = Object.freeze([
  { id: 'default', name: 'По умолчанию', value: '', category: 'system' },
  { id: 'system', name: 'Системный', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', category: 'system' },

  { id: 'inter', name: 'Inter', value: '"Inter", sans-serif', google: 'Inter:wght@300;400;500;600;700', category: 'modern', popular: true },
  { id: 'manrope', name: 'Manrope', value: '"Manrope", sans-serif', google: 'Manrope:wght@300;400;500;600;700;800', category: 'modern', popular: true },
  { id: 'outfit', name: 'Outfit', value: '"Outfit", sans-serif', google: 'Outfit:wght@300;400;500;600;700', category: 'modern', popular: true },
  { id: 'plus-jakarta', name: 'Plus Jakarta Sans', value: '"Plus Jakarta Sans", sans-serif', google: 'Plus+Jakarta+Sans:wght@300;400;500;600;700', category: 'modern' },
  { id: 'space-grotesk', name: 'Space Grotesk', value: '"Space Grotesk", sans-serif', google: 'Space+Grotesk:wght@300;400;500;600;700', category: 'modern' },
  { id: 'sora', name: 'Sora', value: '"Sora", sans-serif', google: 'Sora:wght@300;400;500;600;700', category: 'modern' },
  { id: 'urbanist', name: 'Urbanist', value: '"Urbanist", sans-serif', google: 'Urbanist:wght@300;400;500;600;700', category: 'modern' },
  { id: 'dm-sans', name: 'DM Sans', value: '"DM Sans", sans-serif', google: 'DM+Sans:wght@400;500;700', category: 'modern' },

  { id: 'roboto', name: 'Roboto', value: '"Roboto", sans-serif', google: 'Roboto:wght@300;400;500;700', category: 'classic', popular: true },
  { id: 'open-sans', name: 'Open Sans', value: '"Open Sans", sans-serif', google: 'Open+Sans:wght@300;400;500;600;700', category: 'classic' },
  { id: 'lato', name: 'Lato', value: '"Lato", sans-serif', google: 'Lato:wght@300;400;700;900', category: 'classic' },
  { id: 'montserrat', name: 'Montserrat', value: '"Montserrat", sans-serif', google: 'Montserrat:wght@300;400;500;600;700', category: 'classic', popular: true },
  { id: 'poppins', name: 'Poppins', value: '"Poppins", sans-serif', google: 'Poppins:wght@300;400;500;600;700', category: 'classic' },
  { id: 'nunito', name: 'Nunito', value: '"Nunito", sans-serif', google: 'Nunito:wght@300;400;500;600;700', category: 'classic' },
  { id: 'raleway', name: 'Raleway', value: '"Raleway", sans-serif', google: 'Raleway:wght@300;400;500;600;700', category: 'classic' },
  { id: 'rubik', name: 'Rubik', value: '"Rubik", sans-serif', google: 'Rubik:wght@300;400;500;600;700', category: 'classic' },
  { id: 'ubuntu', name: 'Ubuntu', value: '"Ubuntu", sans-serif', google: 'Ubuntu:wght@300;400;500;700', category: 'classic' },
  { id: 'source-sans', name: 'Source Sans 3', value: '"Source Sans 3", sans-serif', google: 'Source+Sans+3:wght@300;400;500;600;700', category: 'classic' },

  { id: 'bebas-neue', name: 'Bebas Neue', value: '"Bebas Neue", sans-serif', google: 'Bebas+Neue', category: 'stylish', stylish: true },
  { id: 'oswald', name: 'Oswald', value: '"Oswald", sans-serif', google: 'Oswald:wght@300;400;500;600;700', category: 'stylish', stylish: true },
  { id: 'righteous', name: 'Righteous', value: '"Righteous", cursive', google: 'Righteous', category: 'stylish', stylish: true },
  { id: 'fredoka', name: 'Fredoka', value: '"Fredoka", sans-serif', google: 'Fredoka:wght@300;400;500;600;700', category: 'stylish', stylish: true },
  { id: 'comfortaa', name: 'Comfortaa', value: '"Comfortaa", cursive', google: 'Comfortaa:wght@300;400;500;600;700', category: 'stylish', stylish: true },
  { id: 'quicksand', name: 'Quicksand', value: '"Quicksand", sans-serif', google: 'Quicksand:wght@300;400;500;600;700', category: 'stylish' },
  { id: 'pacifico', name: 'Pacifico', value: '"Pacifico", cursive', google: 'Pacifico', category: 'stylish', stylish: true, decorative: true },
  { id: 'satisfy', name: 'Satisfy', value: '"Satisfy", cursive', google: 'Satisfy', category: 'stylish', stylish: true, decorative: true },
  { id: 'lobster', name: 'Lobster', value: '"Lobster", cursive', google: 'Lobster', category: 'stylish', stylish: true, decorative: true },
  { id: 'permanent-marker', name: 'Permanent Marker', value: '"Permanent Marker", cursive', google: 'Permanent+Marker', category: 'stylish', stylish: true, decorative: true },
  { id: 'caveat', name: 'Caveat', value: '"Caveat", cursive', google: 'Caveat:wght@400;500;600;700', category: 'stylish', stylish: true },
  { id: 'dancing-script', name: 'Dancing Script', value: '"Dancing Script", cursive', google: 'Dancing+Script:wght@400;500;600;700', category: 'stylish', stylish: true, decorative: true },

  { id: 'jost', name: 'Jost', value: '"Jost", sans-serif', google: 'Jost:wght@300;400;500;600;700', category: 'geometric' },
  { id: 'josefin-sans', name: 'Josefin Sans', value: '"Josefin Sans", sans-serif', google: 'Josefin+Sans:wght@300;400;500;600;700', category: 'geometric' },
  { id: 'exo-2', name: 'Exo 2', value: '"Exo 2", sans-serif', google: 'Exo+2:wght@300;400;500;600;700', category: 'geometric' },
  { id: 'orbitron', name: 'Orbitron', value: '"Orbitron", sans-serif', google: 'Orbitron:wght@400;500;600;700;800;900', category: 'geometric', stylish: true },
  { id: 'rajdhani', name: 'Rajdhani', value: '"Rajdhani", sans-serif', google: 'Rajdhani:wght@300;400;500;600;700', category: 'geometric' },

  { id: 'merriweather', name: 'Merriweather', value: '"Merriweather", serif', google: 'Merriweather:wght@300;400;700;900', category: 'serif', serif: true },
  { id: 'playfair', name: 'Playfair Display', value: '"Playfair Display", serif', google: 'Playfair+Display:wght@400;500;600;700', category: 'serif', serif: true, popular: true },
  { id: 'lora', name: 'Lora', value: '"Lora", serif', google: 'Lora:wght@400;500;600;700', category: 'serif', serif: true },
  { id: 'pt-serif', name: 'PT Serif', value: '"PT Serif", serif', google: 'PT+Serif:wght@400;700', category: 'serif', serif: true },
  { id: 'eb-garamond', name: 'EB Garamond', value: '"EB Garamond", serif', google: 'EB+Garamond:wght@400;500;600;700', category: 'serif', serif: true },
  { id: 'cormorant', name: 'Cormorant Garamond', value: '"Cormorant Garamond", serif', google: 'Cormorant+Garamond:wght@300;400;500;600;700', category: 'serif', serif: true },
  { id: 'crimson-pro', name: 'Crimson Pro', value: '"Crimson Pro", serif', google: 'Crimson+Pro:wght@300;400;500;600;700', category: 'serif', serif: true },
  { id: 'libre-baskerville', name: 'Libre Baskerville', value: '"Libre Baskerville", serif', google: 'Libre+Baskerville:wght@400;700', category: 'serif', serif: true },
  { id: 'spectral', name: 'Spectral', value: '"Spectral", serif', google: 'Spectral:wght@300;400;500;600;700', category: 'serif', serif: true },
  { id: 'bitter', name: 'Bitter', value: '"Bitter", serif', google: 'Bitter:wght@300;400;500;600;700', category: 'serif', serif: true },

  { id: 'jetbrains-mono', name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', google: 'JetBrains+Mono:wght@300;400;500;600;700', category: 'mono', mono: true, popular: true },
  { id: 'fira-code', name: 'Fira Code', value: '"Fira Code", monospace', google: 'Fira+Code:wght@300;400;500;600;700', category: 'mono', mono: true },
  { id: 'source-code-pro', name: 'Source Code Pro', value: '"Source Code Pro", monospace', google: 'Source+Code+Pro:wght@300;400;500;600;700', category: 'mono', mono: true },
  { id: 'roboto-mono', name: 'Roboto Mono', value: '"Roboto Mono", monospace', google: 'Roboto+Mono:wght@300;400;500;600;700', category: 'mono', mono: true },
  { id: 'ubuntu-mono', name: 'Ubuntu Mono', value: '"Ubuntu Mono", monospace', google: 'Ubuntu+Mono:wght@400;700', category: 'mono', mono: true },
  { id: 'space-mono', name: 'Space Mono', value: '"Space Mono", monospace', google: 'Space+Mono:wght@400;700', category: 'mono', mono: true },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', value: '"IBM Plex Mono", monospace', google: 'IBM+Plex+Mono:wght@300;400;500;600;700', category: 'mono', mono: true },

  { id: 'pt-sans', name: 'PT Sans', value: '"PT Sans", sans-serif', google: 'PT+Sans:wght@400;700', category: 'cyrillic' },
  { id: 'pt-mono', name: 'PT Mono', value: '"PT Mono", monospace', google: 'PT+Mono', category: 'mono', mono: true },
  { id: 'alice', name: 'Alice', value: '"Alice", serif', google: 'Alice', category: 'cyrillic', serif: true },
  { id: 'bad-script', name: 'Bad Script', value: '"Bad Script", cursive', google: 'Bad+Script', category: 'cyrillic', stylish: true },
  { id: 'marck-script', name: 'Marck Script', value: '"Marck Script", cursive', google: 'Marck+Script', category: 'cyrillic', stylish: true, decorative: true },
  { id: 'ruslan-display', name: 'Ruslan Display', value: '"Ruslan Display", cursive', google: 'Ruslan+Display', category: 'cyrillic', stylish: true, decorative: true },
  { id: 'kelly-slab', name: 'Kelly Slab', value: '"Kelly Slab", cursive', google: 'Kelly+Slab', category: 'cyrillic', stylish: true },
  { id: 'podkova', name: 'Podkova', value: '"Podkova", serif', google: 'Podkova:wght@400;500;600;700;800', category: 'cyrillic', serif: true },

  { id: 'atkinson', name: 'Atkinson Hyperlegible', value: '"Atkinson Hyperlegible", sans-serif', google: 'Atkinson+Hyperlegible:wght@400;700', category: 'readable' },
  { id: 'lexend', name: 'Lexend', value: '"Lexend", sans-serif', google: 'Lexend:wght@300;400;500;600;700', category: 'readable' },
  { id: 'opendyslexic', name: 'OpenDyslexic', value: '"OpenDyslexic", sans-serif', google: 'OpenDyslexic', category: 'readable' },
]);

export const FONT_SIZE_PRESETS: readonly FontSizePreset[] = Object.freeze([
  { id: 'sm', name: 'Мелкий', value: 10 },
  { id: 'md', name: 'Обычный', value: 0 },
  { id: 'lg', name: 'Крупнее', value: 16 },
  { id: 'xl', name: 'Большой', value: 19 },
  { id: '2xl', name: 'Очень большой', value: 22 },
  { id: '3xl', name: 'Огромный', value: 25 },
]);

export const FONT_CATEGORIES: readonly FontCategory[] = Object.freeze([
  { id: 'all', name: 'Все', icon: '🔤', description: 'Все доступные шрифты' },
  { id: 'popular', name: 'Популярные', icon: '⭐', description: 'Самые используемые шрифты' },
  { id: 'modern', name: 'Современные', icon: '✨', description: 'Трендовые шрифты 2024-2025' },
  { id: 'classic', name: 'Классические', icon: '📖', description: 'Проверенные временем' },
  { id: 'stylish', name: 'Стильные', icon: '🎨', description: 'Декоративные и креативные' },
  { id: 'serif', name: 'С засечками', icon: '📜', description: 'Классические serif шрифты' },
  { id: 'mono', name: 'Моноширинные', icon: '💻', description: 'Для кода и технических текстов' },
  { id: 'cyrillic', name: 'Кириллица', icon: '🇷🇺', description: 'Специальные для русского языка' },
  { id: 'readable', name: 'Для чтения', icon: '👁️', description: 'Максимальная читаемость' },
  { id: 'geometric', name: 'Геометрические', icon: '📐', description: 'Строгие геометрические формы' },
  { id: 'system', name: 'Системные', icon: '⚙️', description: 'Встроенные шрифты' },
]);