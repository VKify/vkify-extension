import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideRecommendationsFeature } from './hide-recommendations.js';
import { registerHideMiniChatFeature } from './hide-mini-chat.js';
import { registerHideScrollTopFeature } from './hide-scroll-top.js';
import { registerHideAuthPopupFeature } from './hide-auth-popup.js';

/** Элементы, видимые по всему сайту — страница «Глобально» хаба «Элементы». */
export function registerGlobalElements(manager: FeatureManager): void {
  registerHideRecommendationsFeature(manager);
  registerHideMiniChatFeature(manager);
  registerHideScrollTopFeature(manager);
  registerHideAuthPopupFeature(manager);
}
