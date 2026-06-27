import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideRecommendationsFeature } from './hide-recommendations.js';
import { hideMiniChatFeature } from './hide-mini-chat.js';
import { hideScrollTopFeature } from './hide-scroll-top.js';
import { registerHideAuthPopupFeature } from './hide-auth-popup.js';

/** Элементы, видимые по всему сайту — страница «Глобально» хаба «Скрытие». */
export function registerGlobalHiding(manager: FeatureManager): void {
  manager.registerDefinitions([
    hideRecommendationsFeature,
    hideMiniChatFeature,
    hideScrollTopFeature,
  ]);
  // hide_auth_popup — stateful (setInterval + чистка DOM), остаётся на handler-API.
  registerHideAuthPopupFeature(manager);
}
