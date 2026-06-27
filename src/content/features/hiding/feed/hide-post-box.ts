import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает блок «добавить пост» в верху ленты — чистый CSS (hide-post-box.css). */
export const hidePostBoxFeature: FeatureDefinition = cssFeature({
  id: 'hide_post_box',
  name: 'Скрыть поле записи',
  category: 'hiding',
  cssFiles: 'hiding/feed/hide-post-box.css',
});
