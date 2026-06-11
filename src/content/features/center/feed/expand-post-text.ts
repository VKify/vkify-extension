import type { FeatureManager } from '../../../core/feature-manager.js';

/** Разворачивает текст постов целиком (CSS — expand-post-text.css). */
export function registerExpandPostTextFeature(manager: FeatureManager): void {
  manager.register('expand_post_text', {
    enable: () => manager.enableCss('expand_post_text'),
    disable: () => manager.disableCss('expand_post_text'),
  });
}
