import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает комментарии под постами — чистый CSS (hide-post-comments.css). */
export const hidePostCommentsFeature: FeatureDefinition = cssFeature({
  id: 'hide_post_comments',
  name: 'Скрыть комментарии',
  category: 'hiding',
  cssFiles: 'hiding/feed/hide-post-comments.css',
});
