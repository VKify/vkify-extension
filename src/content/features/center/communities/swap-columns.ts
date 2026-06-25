import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Меняет местами колонки страницы сообщества (CSS — swap-columns.css). */
export function registerSwapCommunitiesColumnsFeature(manager: FeatureManager): void {
  manager.register('communities_swap_columns', {
    enable: () => manager.enableCss('communities_swap_columns'),
    disable: () => manager.disableCss('communities_swap_columns'),
  });
}
