import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает пункт «Настройки» в левом меню. */
export function registerHideMenuSettingsFeature(manager: FeatureManager): void {
  manager.register('hide_menu_settings', {
    enable: () => {
      manager.injectCSS('hide_menu_settings', `
        [class*="LeftMenuItem"][class*="settings"],
        [class*="vkitLeftMenuItem__settings"],
        .left_menu_nav [href*="/settings"], #l_set {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_menu_settings'),
  });
}
