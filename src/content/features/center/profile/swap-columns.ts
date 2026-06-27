import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Меняет местами колонки страницы профиля — чистый CSS (swap-columns.css). */
export const swapProfileColumnsFeature: FeatureDefinition = cssFeature({
  id: 'profile_swap_columns',
  name: 'Поменять колонки профиля местами',
  category: 'appearance',
  cssFiles: 'center/profile/swap-columns.css',
  tags: ['profile', 'css'],
});
