import type { FeatureManager } from '../../../core/feature-manager.js';

/**
 * Разворачивает текст постов целиком: убирает обрезание «показать ещё» и
 * снимает ограничения line-clamp / max-height / mask с тела поста.
 */
export function registerExpandPostTextFeature(manager: FeatureManager): void {
  manager.register('expand_post_text', {
    enable: () => {
      manager.injectCSS('expand_post_text', `
        :is(.post,[data-testid=post-content-container]) [data-testid=showmoretext-after] {
          display: none;
        }
        :is(.post,[data-testid=post-content-container]) [data-testid=showmoretext-in] {
          display: block !important;
          -webkit-line-clamp: unset !important;
          line-clamp: unset !important;
          mask: unset !important;
          max-height: unset !important;
          overflow: unset !important;
        }
        .PostTextMore {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('expand_post_text'),
  });
}
