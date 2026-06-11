import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок комментариев под постами. */
export function registerHidePostCommentsFeature(manager: FeatureManager): void {
  manager.register('hide_post_comments', {
    enable: () => {
      manager.injectCSS('hide_post_comments', `
        [data-testid="wall_comments_layout_root"] {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_post_comments'),
  });
}
