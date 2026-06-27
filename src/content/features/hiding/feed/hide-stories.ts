import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает блок историй в верху новостной ленты — чистый CSS (hide-stories.css). */
export const hideStoriesFeature: FeatureDefinition = cssFeature({
  id: 'hide_stories',
  name: 'Скрыть истории',
  category: 'hiding',
  cssFiles: 'hiding/feed/hide-stories.css',
});
