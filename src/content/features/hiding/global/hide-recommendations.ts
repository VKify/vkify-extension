import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает блоки рекомендованного контента — чистый CSS (hide-recommendations.css). */
export const hideRecommendationsFeature: FeatureDefinition = cssFeature({
  id: 'hide_recommendations',
  name: 'Скрыть рекомендации',
  category: 'hiding',
  cssFiles: 'hiding/global/hide-recommendations.css',
});
