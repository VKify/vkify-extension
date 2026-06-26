import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideEmojiStatusFeature } from './hide-emoji-status.js';
import { registerHideStoriesDiscoverFeature } from './hide-stories-discover.js';
import { registerHidePromoLinkFeature } from './hide-promo-link.js';
import { registerHideProfileRightColumnFeature } from './hide-right-column.js';

/** Элементы страниц пользователей — страница «Профиль» хаба «Скрытие» в попапе. */
export function registerProfileHiding(manager: FeatureManager): void {
  registerHideEmojiStatusFeature(manager);
  registerHideStoriesDiscoverFeature(manager);
  registerHidePromoLinkFeature(manager);
  registerHideProfileRightColumnFeature(manager);
}