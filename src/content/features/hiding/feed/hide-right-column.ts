import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает правую колонку с фильтрами в ленте — чистый CSS (hide-right-column.css). */
export const hideFeedRightColumnFeature: FeatureDefinition = cssFeature({
  id: 'hide_feed_right_column',
  name: 'Скрыть правую колонку ленты',
  category: 'hiding',
  cssFiles: 'hiding/feed/hide-right-column.css',
});
