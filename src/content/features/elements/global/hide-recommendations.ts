import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает блоки рекомендованного контента (CSS — hide-recommendations.css). */
export function registerHideRecommendationsFeature(manager: FeatureManager): void {
  manager.register('hide_recommendations', {
    enable: () => manager.enableCss('hide_recommendations'),
    disable: () => manager.disableCss('hide_recommendations'),
  });
}
