import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает пункт «Настройки» в левом меню (CSS — hide-menu-settings.css). */
export function registerHideMenuSettingsFeature(manager: FeatureManager): void {
  manager.register('hide_menu_settings', {
    enable: () => manager.enableCss('hide_menu_settings'),
    disable: () => manager.disableCss('hide_menu_settings'),
  });
}
