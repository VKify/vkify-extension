import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideRecommendedChannelsFeature } from './hide-recommended-channels.js';
import { hideChannelsTabFeature } from './hide-channels-tab.js';
import { hideBusinessNotificationsFeature } from './hide-business-notifications.js';

/** Элементы мессенджера — страница «Мессенджер» хаба «Скрытие». */
export function registerMessengerHiding(manager: FeatureManager): void {
  manager.registerDefinition(hideRecommendedChannelsFeature);
  manager.registerDefinition(hideChannelsTabFeature);
  manager.registerDefinition(hideBusinessNotificationsFeature);
}
