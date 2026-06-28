import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideRecommendationsFeature } from './hide-recommendations.js';
import { hideMiniChatFeature } from './hide-mini-chat.js';
import { hideScrollTopFeature } from './hide-scroll-top.js';

/** Элементы, видимые по всему сайту — страница «Глобально» хаба «Скрытие». */
export function registerGlobalHiding(manager: FeatureManager): void {
  manager.registerDefinitions([
    hideRecommendationsFeature,
    hideMiniChatFeature,
    hideScrollTopFeature,
  ]);
}
