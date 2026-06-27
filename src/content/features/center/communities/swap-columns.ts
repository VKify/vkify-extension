import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Меняет местами колонки страницы сообщества — чистый CSS (swap-columns.css). */
export const swapCommunitiesColumnsFeature: FeatureDefinition = cssFeature({
  id: 'communities_swap_columns',
  name: 'Поменять колонки сообщества местами',
  category: 'appearance',
  cssFiles: 'center/communities/swap-columns.css',
  tags: ['communities', 'css'],
});