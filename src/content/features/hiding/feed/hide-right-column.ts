import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает правую колонку с фильтрами в ленте (CSS — hide-right-column.css). */
export function registerHideFeedRightColumnFeature(manager: FeatureManager): void {
  manager.register('hide_feed_right_column', {
    enable: () => manager.enableCss('hide_feed_right_column'),
    disable: () => manager.disableCss('hide_feed_right_column'),
  });
}
