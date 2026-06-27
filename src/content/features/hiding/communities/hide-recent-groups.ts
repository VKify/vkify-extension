import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает недавние группы в «Сообществах» — чистый CSS (hide-recent-groups.css). */
export const hideRecentGroupsFeature: FeatureDefinition = cssFeature({
  id: 'hide_recent_groups',
  name: 'Скрыть недавние сообщества',
  category: 'hiding',
  cssFiles: 'hiding/communities/hide-recent-groups.css',
});
