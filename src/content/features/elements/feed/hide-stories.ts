import type { FeatureManager } from '@/content/core/feature-manager.js';

/** Скрывает блок историй в верху новостной ленты (CSS — hide-stories.css). */
export function registerHideStoriesFeature(manager: FeatureManager): void {
  manager.register('hide_stories', {
    enable: () => manager.enableCss('hide_stories'),
    disable: () => manager.disableCss('hide_stories'),
  });
}
