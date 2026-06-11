import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает блок рекомендуемых каналов в мессенджере. */
export function registerHideRecommendedChannelsFeature(manager: FeatureManager): void {
  manager.register('hide_recommended_channels', {
    enable: () => {
      manager.injectCSS('hide_recommended_channels', `
        #page_body [data-testid=channels_list_recommended] {
          display: none !important;
        }
      `);
    },
    disable: () => manager.removeCSS('hide_recommended_channels'),
  });
}
