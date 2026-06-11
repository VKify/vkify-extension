import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerHideStoriesFeature } from './hide-stories.js';

/** Элементы новостной ленты — страница «Лента» хаба «Элементы» в попапе. */
export function registerFeedElements(manager: FeatureManager): void {
  registerHideStoriesFeature(manager);
}
