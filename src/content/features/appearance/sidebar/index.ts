import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

export { createMenuItemsFeature } from './menu-items.js';

/**
 * Фичи левого меню — чистый CSS (декларативный API, см. [[feature-definition]]).
 * Каждая лишь ставит/снимает маркер data-vkify-<id> на <html>, по которому
 * срабатывают colocated-стили (собираются в features.css):
 *   • minimalistic-sidebar.css     — колонка иконок + тултип по наведению;
 *   • sidebar-with-background.css  — меню карточкой с фоном/тенью;
 *   • fixed-sidebar.css            — прилипание меню при скролле.
 *
 * Прежний полностью-JS вариант (обход DOM, замер шапки) сохранён в ветке
 * backup/sidebar-js на случай смены вёрстки ВК.
 */
export const sidebarFeatures: readonly FeatureDefinition[] = [
  cssFeature({
    id: 'minimalistic_sidebar',
    name: 'Минималистичный сайдбар',
    category: 'appearance',
    cssFiles: 'appearance/sidebar/minimalistic-sidebar.css',
  }),
  cssFeature({
    id: 'sidebar_with_background',
    name: 'Сайдбар с фоном',
    category: 'appearance',
    cssFiles: 'appearance/sidebar/sidebar-with-background.css',
  }),
  cssFeature({
    id: 'fixed_sidebar',
    name: 'Фиксированный сайдбар',
    category: 'appearance',
    cssFiles: 'appearance/sidebar/fixed-sidebar.css',
  }),
];