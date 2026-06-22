import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';

export { createMenuItemsFeature } from './menu-items.js';

/**
 * Фичи левого меню — чистый CSS. Каждая лишь ставит/снимает маркер
 * data-vkify-<id> на <html>, по которому срабатывают colocated-стили
 * (собираются в features.css):
 *   • minimalistic-sidebar.css     — колонка иконок + тултип по наведению;
 *   • sidebar-with-background.css  — меню карточкой с фоном/тенью;
 *   • fixed-sidebar.css            — прилипание меню при скролле.
 *
 * Прежний полностью-JS вариант (обход DOM, замер шапки) сохранён в ветке
 * backup/sidebar-js на случай смены вёрстки ВК.
 */
export function createSidebarFeatures(manager: FeatureManager): FeatureMap {
  return {
    minimalistic_sidebar: {
      enable: () => manager.enableCss('minimalistic_sidebar'),
      disable: () => manager.disableCss('minimalistic_sidebar'),
    },
    sidebar_with_background: {
      enable: () => manager.enableCss('sidebar_with_background'),
      disable: () => manager.disableCss('sidebar_with_background'),
    },
    fixed_sidebar: {
      enable: () => manager.enableCss('fixed_sidebar'),
      disable: () => manager.disableCss('fixed_sidebar'),
    },
  };
}