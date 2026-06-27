import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideEmojiStatusFeature } from './hide-emoji-status.js';
import { hideStoriesDiscoverFeature } from './hide-stories-discover.js';
import { hidePromoLinkFeature } from './hide-promo-link.js';
import { hideProfileRightColumnFeature } from './hide-right-column.js';

/** Элементы страниц пользователей — страница «Профиль» хаба «Скрытие» в попапе. */
export function registerProfileHiding(manager: FeatureManager): void {
  manager.registerDefinitions([
    hideEmojiStatusFeature,
    hideStoriesDiscoverFeature,
    hidePromoLinkFeature,
    hideProfileRightColumnFeature,
  ]);
}