import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает счётчики (бейджи с числами) у пунктов левого меню. */
export function registerHideMenuCountersFeature(manager: FeatureManager): void {
  manager.register('hide_menu_counters', {
    enable: () => {
      manager.injectCSS('hide_menu_counters', `
        .vkuiInternalCounter[data-testid=leftmenuitem-counter],
        .left_count_wrap, [class*=LeftMenuItem__counter] {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_menu_counters'),
  });
}
