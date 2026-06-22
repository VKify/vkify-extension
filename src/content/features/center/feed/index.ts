import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerExpandPostTextFeature } from './expand-post-text.js';
import { createStoryDownloadFeature } from '../story/index.js';

/**
 * Фичи ленты — страница «Лента» хаба «Центр» в попапе. Помимо поведения постов
 * сюда же отнесено скачивание историй: они живут в самом верху ленты.
 */
export function registerFeedFeatures(manager: FeatureManager): void {
  registerExpandPostTextFeature(manager);
  manager.registerMultiple(createStoryDownloadFeature(manager));
}
