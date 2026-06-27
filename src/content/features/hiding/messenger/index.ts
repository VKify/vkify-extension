import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideRecommendedChannelsFeature } from './hide-recommended-channels.js';

/** Элементы мессенджера — страница «Мессенджер» хаба «Скрытие». */
export function registerMessengerHiding(manager: FeatureManager): void {
  manager.registerDefinition(hideRecommendedChannelsFeature);
}
