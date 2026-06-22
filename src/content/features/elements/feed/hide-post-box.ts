import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает блок «добавить пост» в верху ленты (CSS — hide-post-box.css). */
export function registerHidePostBoxFeature(manager: FeatureManager): void {
  manager.register('hide_post_box', {
    enable: () => manager.enableCss('hide_post_box'),
    disable: () => manager.disableCss('hide_post_box'),
  });
}
