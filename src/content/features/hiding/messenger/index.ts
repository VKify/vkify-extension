import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideRecommendedChannelsFeature } from './hide-recommended-channels.js';

/** Элементы мессенджера — страница «Мессенджер» хаба «Скрытие». */
export function registerMessengerHiding(manager: FeatureManager): void {
  registerHideRecommendedChannelsFeature(manager);
}
