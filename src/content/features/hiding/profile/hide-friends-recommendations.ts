import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает блок «Возможно, вы знакомы» на странице профиля. */
export const hideProfileFriendsRecommendationsFeature: FeatureDefinition = cssFeature({
  id: 'hide_profile_friends_recommendations',
  name: 'Скрыть рекомендации друзей на профиле',
  category: 'hiding',
  cssFiles: 'hiding/profile/hide-friends-recommendations.css',
});
