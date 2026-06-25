import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Меняет местами колонки страницы профиля (CSS — swap-columns.css). */
export function registerSwapProfileColumnsFeature(manager: FeatureManager): void {
  manager.register('profile_swap_columns', {
    enable: () => manager.enableCss('profile_swap_columns'),
    disable: () => manager.disableCss('profile_swap_columns'),
  });
}
