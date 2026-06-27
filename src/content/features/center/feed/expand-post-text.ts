import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Разворачивает текст постов целиком — чистый CSS (expand-post-text.css). */
export const expandPostTextFeature: FeatureDefinition = cssFeature({
  id: 'expand_post_text',
  name: 'Разворачивать текст постов',
  category: 'feed',
  cssFiles: 'center/feed/expand-post-text.css',
  tags: ['feed', 'css'],
});
