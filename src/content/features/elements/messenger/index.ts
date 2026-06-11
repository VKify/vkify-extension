import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerHideRecommendedChannelsFeature } from './hide-recommended-channels.js';

/** Элементы мессенджера — страница «Мессенджер» хаба «Элементы». */
export function registerMessengerElements(manager: FeatureManager): void {
  registerHideRecommendedChannelsFeature(manager);
}
