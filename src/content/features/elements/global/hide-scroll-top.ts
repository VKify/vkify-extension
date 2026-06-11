import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает кнопку прокрутки «Наверх» (CSS — hide-scroll-top.css). */
export function registerHideScrollTopFeature(manager: FeatureManager): void {
  manager.register('hide_scroll_top', {
    enable: () => manager.enableCss('hide_scroll_top'),
    disable: () => manager.disableCss('hide_scroll_top'),
  });
}
