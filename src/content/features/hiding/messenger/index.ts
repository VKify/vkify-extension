import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideRecommendedChannelsFeature } from './hide-recommended-channels.js';
import { hideChannelsTabFeature } from './hide-channels-tab.js';
import { hideBusinessNotificationsFeature } from './hide-business-notifications.js';
import { hideMessengerFiltersFeature } from './hide-messenger-filters.js';
import { hideMessengerActionsFeature } from './hide-messenger-actions.js';

/** Элементы мессенджера — страница «Мессенджер» хаба «Скрытие». */
export function registerMessengerHiding(manager: FeatureManager): void {
  manager.registerDefinition(hideRecommendedChannelsFeature);
  manager.registerDefinition(hideChannelsTabFeature);
  manager.registerDefinition(hideBusinessNotificationsFeature);
  manager.registerDefinition(hideMessengerFiltersFeature);
  manager.registerDefinition(hideMessengerActionsFeature);
}
