import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок «добавить пост» в верху новостной ленты. */
export function registerHidePostBoxFeature(manager: FeatureManager): void {
  manager.register('hide_post_box', {
    enable: () => {
      manager.injectCSS('hide_post_box', `
        [data-testid=feed_main_container] > div:nth-child(3),
        [data-testid=feed_main_container] > .stSpacing__root:nth-child(4) {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_post_box'),
  });
}
