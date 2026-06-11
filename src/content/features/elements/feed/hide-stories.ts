import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок историй в верху новостной ленты. */
export function registerHideStoriesFeature(manager: FeatureManager): void {
  manager.register('hide_stories', {
    reapplyOnNavigate: true,
    enable: () => {
      manager.injectCSS('hide_stories', `
        [class*="StoriesSection"], [class*="stories_feed"],
        [class*="StoryBlock"], .stories_feed_wrap, ._stories_wrap {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_stories'),
  });
}
