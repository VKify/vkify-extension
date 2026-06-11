import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает комментарии под постами (CSS — hide-post-comments.css). */
export function registerHidePostCommentsFeature(manager: FeatureManager): void {
  manager.register('hide_post_comments', {
    enable: () => manager.enableCss('hide_post_comments'),
    disable: () => manager.disableCss('hide_post_comments'),
  });
}
