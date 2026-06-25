import type { FeatureManager } from '../../core/feature-manager.js';
import { createWidescreenFeatures, createPageOffsetFeature, createCompactSpacingFeature } from './layout/index.js';
import { createSidebarFeatures, createMenuItemsFeature } from './sidebar/index.js';
import { createHeaderFeatures } from './header/index.js';
import { createThemeFeatures } from './theme/index.js';
import { createBorderRadiusFeature } from './theme/border-radius.js';
import { createBackgroundFeatures } from './background/index.js';
import { createFilterFeatures } from './filters/index.js';
import { createFontFeatures } from './font/index.js';

export function registerAppearanceFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createWidescreenFeatures(manager));
  manager.registerMultiple(createSidebarFeatures(manager));
  manager.registerMultiple(createMenuItemsFeature(manager));
  manager.registerMultiple(createHeaderFeatures(manager));
  manager.registerMultiple(createThemeFeatures(manager));
  manager.registerMultiple(createBackgroundFeatures(manager));
  manager.registerMultiple(createBorderRadiusFeature(manager));
  manager.registerMultiple(createFilterFeatures(manager));
  manager.registerMultiple(createFontFeatures(manager));
  manager.registerMultiple(createPageOffsetFeature(manager));
  manager.registerMultiple(createCompactSpacingFeature(manager));

  // Оформление: тема/акцент генерируют палитру и инжектят CSS-переменные (medium),
  // остальное — статический/инжектируемый CSS (light). Категория общая 'appearance'.
  manager.describeFeatures({
    // Тема
    custom_theme:           { name: 'Тема оформления',     category: 'appearance', impact: 'medium', initOrder: 5, tags: ['theme', 'css-vars'] },
    custom_accent:          { name: 'Акцентный цвет',      category: 'appearance', impact: 'medium', initOrder: 5, tags: ['theme', 'css-vars'] },
    block_opacity:          { name: 'Прозрачность блоков', category: 'appearance' },
    glass_blur:             { name: 'Размытие стекла',     category: 'appearance' },
    theme_radius:           { name: 'Радиус темы',         category: 'appearance' },
    block_depth:            { name: 'Глубина блоков',      category: 'appearance' },
    border_radius:          { name: 'Скругление углов',    category: 'appearance' },
    avatar_radius_shape:    { name: 'Форма аватара',       category: 'appearance' },
    // Лэйаут
    content_width:          { name: 'Ширина контента',     category: 'appearance' },
    content_width_enabled:  { name: 'Ширина контента (вкл)', category: 'appearance' },
    compact_spacing:        { name: 'Компактные отступы',  category: 'appearance' },
    page_offset_enabled:    { name: 'Смещение страницы (вкл)', category: 'appearance' },
    page_offset_value:      { name: 'Смещение страницы',   category: 'appearance' },
    // Сайдбар / меню
    collapse_search:        { name: 'Свернуть поиск',         category: 'appearance' },
    fixed_sidebar:          { name: 'Фиксированный сайдбар',  category: 'appearance' },
    minimalistic_sidebar:   { name: 'Минималистичный сайдбар', category: 'appearance' },
    sidebar_with_background: { name: 'Сайдбар с фоном',        category: 'appearance' },
    hidden_menu_items:      { name: 'Скрытые пункты меню',  category: 'appearance' },
    // Фон
    custom_background:      { name: 'Фон',                 category: 'appearance', impact: 'medium', requiresDomLayer: true, tags: ['wallpaper'] },
    background_video_speed: { name: 'Видео-фон: скорость', category: 'appearance' },
    background_video_volume:{ name: 'Видео-фон: громкость', category: 'appearance' },
    // Шрифт
    custom_font_id:         { name: 'Шрифт',               category: 'appearance', tags: ['font'] },
    custom_font_value:      { name: 'Шрифт: значение',     category: 'appearance', tags: ['font'] },
    custom_font_size:       { name: 'Размер шрифта',       category: 'appearance', tags: ['font'] },
    custom_font_weight:     { name: 'Насыщенность шрифта', category: 'appearance', tags: ['font'] },
    custom_font_style:      { name: 'Стиль шрифта',        category: 'appearance', tags: ['font'] },
    custom_line_height:     { name: 'Межстрочный интервал', category: 'appearance', tags: ['font'] },
    custom_letter_spacing:  { name: 'Межбуквенный интервал', category: 'appearance', tags: ['font'] },
    custom_text_decoration: { name: 'Оформление текста',   category: 'appearance', tags: ['font'] },
    custom_text_transform:  { name: 'Регистр текста',      category: 'appearance', tags: ['font'] },
  });
}
