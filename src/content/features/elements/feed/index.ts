import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideStoriesFeature } from './hide-stories.js';
import { registerHidePostBoxFeature } from './hide-post-box.js';
import { registerHidePostCommentsFeature } from './hide-post-comments.js';

/** Элементы новостной ленты — страница «Лента» хаба «Элементы» в попапе. */
export function registerFeedElements(manager: FeatureManager): void {
  registerHideStoriesFeature(manager);
  registerHidePostBoxFeature(manager);
  registerHidePostCommentsFeature(manager);
}
