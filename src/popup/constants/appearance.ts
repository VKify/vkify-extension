import type { Theme } from '@/shared/theme-presets.js';
import { THEMES } from '@/shared/theme-presets.js';
export type { Theme } from '@/shared/theme-presets.js';

export interface ThemeCategory {
  id: string;
  name: string;
}

export interface DisplayMode {
  id: string;
  title: string;
  description: string;
  iconId: string;
}

export interface VisualFilter {
  id: string;
  title: string;
  iconId: 'contrast' | 'droplet' | 'refresh' | 'moon' | 'sun' | 'eye';
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
  /** Семантический ключ иконки (см. background/icons.tsx), вместо эмодзи. */
  iconId?: string;
}

export interface BackgroundPosition {
  id: string;
  name: string;
  value: string;
}

export interface BackgroundPreset {
  id: string;
  name: string;
  /** Семантический ключ иконки (см. background/icons.tsx), вместо эмодзи. */
  iconId: string;
  settings: Record<string, number | undefined>;
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
  description: string;
}

export { THEMES } from '@/shared/theme-presets.js';

export const THEME_CATEGORIES: readonly ThemeCategory[] = Object.freeze([
  { id: 'all', name: 'Все' },
  { id: 'classic', name: 'Классика' },
  { id: 'soft', name: 'Мягкие' },
  { id: 'amoled', name: 'AMOLED' },
  { id: 'colored', name: 'Цветные' },
  { id: 'neon', name: 'Неоновые' },
  { id: 'nature', name: 'Природа' },
  { id: 'minimal', name: 'Минимализм' },
  { id: 'retro', name: 'Ретро' },
  { id: 'warm', name: 'Тёплые' },
  { id: 'cool', name: 'Холодные' },
]);

export const DISPLAY_MODES: readonly DisplayMode[] = Object.freeze([
  { id: 'minimalistic_sidebar', title: 'Компактное меню', description: 'Узкая боковая панель с иконками', iconId: 'sidebar' },
  { id: 'fixed_sidebar', title: 'Фиксированное меню', description: 'Меню остаётся на месте при прокрутке', iconId: 'sidebar' },
  { id: 'sidebar_with_background', title: 'Меню с фоном', description: 'Добавляет фон боковому меню', iconId: 'sidebar' },
  { id: 'static_header', title: 'Статичная шапка', description: 'Шапка уходит вверх при прокрутке страницы', iconId: 'header' },
  { id: 'auto_hide_header', title: 'Шапка по направлению прокрутки', description: 'Скрывается при прокрутке вниз и возвращается при прокрутке вверх', iconId: 'header' },
  { id: 'compact_header', title: 'Компактная шапка', description: 'Уменьшает высоту шапки до 40 px', iconId: 'header' },
  { id: 'collapse_search', title: 'Свернуть поиск', description: 'Поле поиска сворачивается в иконку', iconId: 'search' },
]);

export const VISUAL_FILTERS: readonly VisualFilter[] = Object.freeze([
  { id: 'filter_grayscale', title: 'Чёрно-белый', iconId: 'droplet', description: 'Убрать все цвета' },
  { id: 'filter_sepia', title: 'Сепия', iconId: 'sun', description: 'Тёплый винтажный оттенок' },
  { id: 'filter_invert', title: 'Инверсия', iconId: 'refresh', description: 'Инвертировать все цвета' },
  { id: 'filter_dim_images', title: 'Затемнить фото', iconId: 'moon', description: 'Приглушить яркость изображений' },
  { id: 'filter_low_brightness', title: 'Низкая яркость', iconId: 'eye', description: 'Снизить яркость страницы' },
  { id: 'filter_high_contrast', title: 'Высокий контраст', iconId: 'contrast', description: 'Увеличить контрастность' },
]);

export const BACKGROUND_SETTINGS: readonly BackgroundSetting[] = Object.freeze([
  { id: 'background_blur', label: 'Размытие', min: 0, max: 50, step: 1, unit: 'px', defaultValue: 8 },
  { id: 'background_dim', label: 'Затемнение', min: 0, max: 90, step: 5, unit: '%', defaultValue: 30 },
  { id: 'background_opacity', label: 'Прозрачность', min: 10, max: 100, step: 5, unit: '%', defaultValue: 100 },
  { id: 'background_scale', label: 'Масштаб', min: 70, max: 150, step: 5, unit: '%', defaultValue: 105 },
]);

export const BACKGROUND_FILTERS: readonly BackgroundSetting[] = Object.freeze([
  { id: 'background_brightness', label: 'Яркость', iconId: 'brightness', min: 50, max: 150, step: 5, unit: '%', defaultValue: 100 },
  { id: 'background_contrast', label: 'Контраст', iconId: 'contrast', min: 50, max: 150, step: 5, unit: '%', defaultValue: 100 },
  { id: 'background_saturation', label: 'Насыщенность', iconId: 'saturation', min: 0, max: 200, step: 10, unit: '%', defaultValue: 100 },
  { id: 'background_hue_rotate', label: 'Оттенок', iconId: 'hue', min: -180, max: 180, step: 15, unit: '°', defaultValue: 0 },
  { id: 'background_sepia', label: 'Сепия', iconId: 'sepia', min: 0, max: 100, step: 10, unit: '%', defaultValue: 0 },
  { id: 'background_grayscale', label: 'Ч/Б', iconId: 'grayscale', min: 0, max: 100, step: 10, unit: '%', defaultValue: 0 },
]);

export const BACKGROUND_EFFECTS: readonly BackgroundSetting[] = Object.freeze([
  { id: 'background_vignette', label: 'Виньетка', iconId: 'vignette', min: 0, max: 80, step: 10, unit: '%', defaultValue: 0 },
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
  { id: 'clear', name: 'Чистый', iconId: 'clear', settings: { blur: 0, dim: 0, brightness: 100, contrast: 100, saturation: 100 } },
  { id: 'soft', name: 'Мягкий', iconId: 'soft', settings: { blur: 15, dim: 20, brightness: 100, contrast: 100, saturation: 90 } },
  { id: 'dreamy', name: 'Мечта', iconId: 'dreamy', settings: { blur: 25, dim: 30, brightness: 110, contrast: 90, saturation: 80 } },
  { id: 'cinematic', name: 'Кино', iconId: 'cinematic', settings: { blur: 5, dim: 40, brightness: 95, contrast: 115, saturation: 90, vignette: 30 } },
  { id: 'vintage', name: 'Винтаж', iconId: 'vintage', settings: { blur: 2, dim: 15, brightness: 95, contrast: 105, saturation: 70, sepia: 30 } },
  { id: 'noir', name: 'Нуар', iconId: 'noir', settings: { blur: 3, dim: 50, brightness: 90, contrast: 120, saturation: 0, grayscale: 100, vignette: 40 } },
  { id: 'vibrant', name: 'Яркий', iconId: 'vibrant', settings: { blur: 8, dim: 10, brightness: 110, contrast: 110, saturation: 130 } },
  { id: 'dark', name: 'Тёмный', iconId: 'dark', settings: { blur: 10, dim: 60, brightness: 80, contrast: 100, saturation: 80 } },
]);

export const VIDEO_SETTINGS = [
  { id: 'background_video_speed', label: 'Скорость', min: 25, max: 200, step: 25, defaultValue: 100, unit: '%' },
  { id: 'background_video_volume', label: 'Громкость', min: 0, max: 100, step: 5, defaultValue: 0, unit: '%' },
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
  { id: 'all', name: 'Все', description: 'Все доступные шрифты' },
  { id: 'popular', name: 'Популярные', description: 'Самые используемые шрифты' },
  { id: 'modern', name: 'Современные', description: 'Трендовые шрифты 2024-2025' },
  { id: 'classic', name: 'Классические', description: 'Проверенные временем' },
  { id: 'stylish', name: 'Стильные', description: 'Декоративные и креативные' },
  { id: 'serif', name: 'С засечками', description: 'Классические serif шрифты' },
  { id: 'mono', name: 'Моноширинные', description: 'Для кода и технических текстов' },
  { id: 'cyrillic', name: 'Кириллица', description: 'Специальные для русского языка' },
  { id: 'readable', name: 'Для чтения', description: 'Максимальная читаемость' },
  { id: 'geometric', name: 'Геометрические', description: 'Строгие геометрические формы' },
  { id: 'system', name: 'Системные', description: 'Встроенные шрифты' },
]);
