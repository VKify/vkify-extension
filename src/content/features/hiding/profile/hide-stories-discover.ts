import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/* Скрывает блок «Истории возможных друзей» на профиле */
export const hideStoriesDiscoverFeature: FeatureDefinition = cssFeature({
  id: 'hide_stories_discover',
  name: 'Скрыть Discover историй',
  category: 'hiding',
  cssFiles: 'hiding/profile/hide-stories-discover.css',
});