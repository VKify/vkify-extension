import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { widescreenFeature, pageOffsetFeature, compactSpacingFeature } from './layout/index.js';
import { createMenuItemsFeature, sidebarFeatures } from './sidebar/index.js';
import { headerFeatures } from './header/index.js';
import { createThemeFeatures } from './theme/index.js';
import { createBorderRadiusFeature } from './theme/border-radius.js';
import { createBackgroundFeatures } from './background/index.js';
import { filterFeatures } from './filters/index.js';
import { createFontFeatures } from './font/index.js';

export function registerAppearanceFeatures(manager: FeatureManager): void {
  // Stateful-фичи (тема/палитра, шрифты, фон, ширина/смещение, аватары, меню):
  // императивные ядра (палитра, rAF/debounce, CSS-переменные) не переписываются —
  // каждая оборачивается handlerFeature с метадатой на месте. Флаги
  // reapplyOnNavigate/reapplyOnUpdate переносятся с обработчиков автоматически.
  const menuItems = createMenuItemsFeature(manager);
  const theme = createThemeFeatures(manager);
  const background = createBackgroundFeatures(manager);
  const borderRadius = createBorderRadiusFeature(manager);
  const font = createFontFeatures(manager);

  manager.registerDefinitions([
    // Тема: тумблеры/значения одного замыкания-палитры (см. theme/feature.ts).
    handlerFeature({ id: 'custom_theme',  name: 'Тема оформления', category: 'appearance', impact: 'medium', initOrder: 5, tags: ['theme', 'css-vars'], handler: theme.custom_theme }),
    handlerFeature({ id: 'custom_accent', name: 'Акцентный цвет',  category: 'appearance', impact: 'medium', initOrder: 5, tags: ['theme', 'css-vars'], handler: theme.custom_accent }),
    handlerFeature({ id: 'theme_radius',  name: 'Радиус темы',     category: 'appearance', handler: theme.theme_radius }),
    handlerFeature({ id: 'block_opacity', name: 'Прозрачность блоков', category: 'appearance', handler: theme.block_opacity }),
    handlerFeature({ id: 'glass_blur',    name: 'Размытие стекла', category: 'appearance', handler: theme.glass_blur }),
    handlerFeature({ id: 'block_depth',   name: 'Глубина блоков',  category: 'appearance', handler: theme.block_depth }),
    // Live-превью цвета из попапа (ENABLE_FEATURE до записи в storage).
    handlerFeature({ id: 'custom_theme_preview',  name: 'Тема (превью)',   category: 'appearance', handler: theme.custom_theme_preview }),
    handlerFeature({ id: 'custom_accent_preview', name: 'Акцент (превью)', category: 'appearance', handler: theme.custom_accent_preview }),

    // Скругления
    handlerFeature({ id: 'border_radius',       name: 'Скругление углов', category: 'appearance', handler: borderRadius.border_radius }),
    handlerFeature({ id: 'avatar_radius_shape', name: 'Форма аватара',    category: 'appearance', handler: borderRadius.avatar_radius_shape }),

    // Лэйаут: ширина/смещение — декларативные derived-CSS-фичи (см. layout/):
    // значение-слайдер — watch-ключ той же фичи, отдельной definition больше нет.
    widescreenFeature,
    pageOffsetFeature,

    // Сайдбар / меню
    handlerFeature({ id: 'hidden_menu_items', name: 'Скрытые пункты меню', category: 'appearance', handler: menuItems.hidden_menu_items }),

    // Фон
    handlerFeature({ id: 'custom_background', name: 'Фон', category: 'appearance', impact: 'medium', requiresDomLayer: true, tags: ['wallpaper'], handler: background.custom_background }),
    handlerFeature({ id: 'background_video_speed',  name: 'Видео-фон: скорость',  category: 'appearance', handler: background.background_video_speed }),
    handlerFeature({ id: 'background_video_volume', name: 'Видео-фон: громкость', category: 'appearance', handler: background.background_video_volume }),
    // Ключи-эффекты фона (тип/blur/затемнение/фильтры/оверлей/виньетка/позиция):
    // каждый перерисовывает фон (перерисовки коалесируются в background/index.ts).
    // ВАЖНО: их регистрация обязательна — иначе storage-изменения из попапа до
    // обработчиков не доходят (registry.has(key) — фильтр реактивности).
    ...([
      'background_type', 'background_blur', 'background_dim', 'background_opacity',
      'background_brightness', 'background_contrast', 'background_saturation',
      'background_scale', 'background_hue_rotate', 'background_sepia',
      'background_grayscale', 'background_position', 'background_size',
      'background_overlay_color', 'background_overlay_opacity', 'background_vignette',
    ] as const).map((id) => handlerFeature({
      id, category: 'appearance', tags: ['wallpaper'], handler: background[id],
    })),

    // Шрифт: девять ключей одного замыкания (см. font/index.ts).
    handlerFeature({ id: 'custom_font_id',         name: 'Шрифт',                 category: 'appearance', tags: ['font'], handler: font.custom_font_id }),
    handlerFeature({ id: 'custom_font_value',      name: 'Шрифт: значение',       category: 'appearance', tags: ['font'], handler: font.custom_font_value }),
    handlerFeature({ id: 'custom_font_size',       name: 'Размер шрифта',         category: 'appearance', tags: ['font'], handler: font.custom_font_size }),
    handlerFeature({ id: 'custom_font_weight',     name: 'Насыщенность шрифта',   category: 'appearance', tags: ['font'], handler: font.custom_font_weight }),
    handlerFeature({ id: 'custom_font_style',      name: 'Стиль шрифта',          category: 'appearance', tags: ['font'], handler: font.custom_font_style }),
    handlerFeature({ id: 'custom_line_height',     name: 'Межстрочный интервал',  category: 'appearance', tags: ['font'], handler: font.custom_line_height }),
    handlerFeature({ id: 'custom_letter_spacing',  name: 'Межбуквенный интервал', category: 'appearance', tags: ['font'], handler: font.custom_letter_spacing }),
    handlerFeature({ id: 'custom_text_decoration', name: 'Оформление текста',     category: 'appearance', tags: ['font'], handler: font.custom_text_decoration }),
    handlerFeature({ id: 'custom_text_transform',  name: 'Регистр текста',        category: 'appearance', tags: ['font'], handler: font.custom_text_transform }),
  ]);

  // Чистые CSS-фичи (bespoke-плагины): метадата живёт в самих определениях.
  manager.registerDefinition(compactSpacingFeature);
  manager.registerDefinitions(sidebarFeatures);
  manager.registerDefinitions(headerFeatures);
  manager.registerDefinitions(filterFeatures);
}
