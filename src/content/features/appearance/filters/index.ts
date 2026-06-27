import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/**
 * Визуальные фильтры — булевы тумблеры (декларативный API). CSS статичный
 * (filters.css); каждая фича лишь переключает маркер data-vkify-<id> на <html>,
 * по которому правила и срабатывают.
 */
const filter = (id: string, name: string): FeatureDefinition =>
  cssFeature({ id, name, category: 'appearance', cssFiles: 'appearance/filters/filters.css', tags: ['filter'] });

export const filterFeatures: readonly FeatureDefinition[] = [
  filter('filter_grayscale', 'Чёрно-белый'),
  filter('filter_sepia', 'Сепия'),
  filter('filter_invert', 'Инверсия цветов'),
  filter('filter_dim_images', 'Затемнить изображения'),
  filter('filter_high_contrast', 'Высокий контраст'),
  filter('filter_low_brightness', 'Пониженная яркость'),
];
