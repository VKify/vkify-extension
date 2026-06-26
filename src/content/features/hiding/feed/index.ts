import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideStoriesFeature } from './hide-stories.js';
import { registerHidePostBoxFeature } from './hide-post-box.js';
import { registerHidePostCommentsFeature } from './hide-post-comments.js';
import { registerHideFeedRightColumnFeature } from './hide-right-column.js';

/** Элементы новостной ленты — страница «Лента» хаба «Скрытие» в попапе. */
export function registerFeedHiding(manager: FeatureManager): void {
  registerHideStoriesFeature(manager);
  registerHidePostBoxFeature(manager);
  registerHidePostCommentsFeature(manager);
  registerHideFeedRightColumnFeature(manager);
}
