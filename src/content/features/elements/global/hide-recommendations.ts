import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блоки рекомендуемого контента (группы, друзья, паблики). */
export function registerHideRecommendationsFeature(manager: FeatureManager): void {
  manager.register('hide_recommendations', {
    reapplyOnNavigate: true,
    enable: () => {
      manager.injectCSS('hide_recommendations', `
        [class*="RecommendedGroups"], [class*="RecommendedContent"],
        [class*="feed_recom"], [class*="FeedRecommendation"],
        .feed_groups_recomm, .feed_friends_recomm,
        ._feed_recommendations, .groups_recomm, .public_recomm {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_recommendations'),
  });
}
