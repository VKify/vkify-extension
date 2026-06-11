import type { FeatureManager } from '../../../core/feature-manager.js';

/** Скрывает рекомендуемые каналы в мессенджере (CSS — hide-recommended-channels.css). */
export function registerHideRecommendedChannelsFeature(manager: FeatureManager): void {
  manager.register('hide_recommended_channels', {
    enable: () => manager.enableCss('hide_recommended_channels'),
    disable: () => manager.disableCss('hide_recommended_channels'),
  });
}
