import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает счётчики у пунктов левого меню (CSS — hide-menu-counters.css). */
export function registerHideMenuCountersFeature(manager: FeatureManager): void {
  manager.register('hide_menu_counters', {
    enable: () => manager.enableCss('hide_menu_counters'),
    disable: () => manager.disableCss('hide_menu_counters'),
  });
}
