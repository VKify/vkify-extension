import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideStoriesFeature } from './hide-stories.js';
import { hidePostBoxFeature } from './hide-post-box.js';
import { hidePostCommentsFeature } from './hide-post-comments.js';
import { hideFeedRightColumnFeature } from './hide-right-column.js';

/** Элементы новостной ленты — страница «Лента» хаба «Скрытие» в попапе. */
export function registerFeedHiding(manager: FeatureManager): void {
  manager.registerDefinitions([
    hideStoriesFeature,
    hidePostBoxFeature,
    hidePostCommentsFeature,
    hideFeedRightColumnFeature,
  ]);
}
