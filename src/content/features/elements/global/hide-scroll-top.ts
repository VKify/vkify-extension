import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает кнопку прокрутки «Наверх». */
export function registerHideScrollTopFeature(manager: FeatureManager): void {
  manager.register('hide_scroll_top', {
    enable: () => {
      manager.injectCSS('hide_scroll_top', `
        #stl_left, .stl_left, .TopButton,
        [class*="ScrollToTop"], [class*="scroll_to_top"] {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_scroll_top'),
  });
}
