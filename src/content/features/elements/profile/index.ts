import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerHideEmojiStatusFeature } from './hide-emoji-status.js';
import { registerHideStoriesDiscoverFeature } from './hide-stories-discover.js';
import { registerHidePromoLinkFeature } from './hide-promo-link.js';

/** Элементы страниц пользователей — страница «Профиль» хаба «Элементы» в попапе. */
export function registerProfileElements(manager: FeatureManager): void {
  registerHideEmojiStatusFeature(manager);
  registerHideStoriesDiscoverFeature(manager);
  registerHidePromoLinkFeature(manager);
}
