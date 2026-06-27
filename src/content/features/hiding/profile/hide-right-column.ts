import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает правую колонку профиля (друзья, подписки) — чистый CSS (hide-right-column.css). */
export const hideProfileRightColumnFeature: FeatureDefinition = cssFeature({
  id: 'hide_profile_right_column',
  name: 'Скрыть правую колонку профиля',
  category: 'hiding',
  cssFiles: 'hiding/profile/hide-right-column.css',
});
