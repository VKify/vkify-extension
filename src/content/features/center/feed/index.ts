import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerExpandPostTextFeature } from './expand-post-text.js';

/** Фичи ленты — страница «Лента» хаба «Центр» в попапе. */
export function registerFeedFeatures(manager: FeatureManager): void {
  registerExpandPostTextFeature(manager);
}
