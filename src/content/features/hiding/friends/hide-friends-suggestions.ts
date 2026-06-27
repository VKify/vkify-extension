import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает блок «Возможные друзья» — чистый CSS (hide-friends-suggestions.css). */
export const hideFriendsSuggestionsFeature: FeatureDefinition = cssFeature({
  id: 'hide_friends_suggestions',
  name: 'Скрыть «возможные друзья»',
  category: 'hiding',
  cssFiles: 'hiding/friends/hide-friends-suggestions.css',
});
