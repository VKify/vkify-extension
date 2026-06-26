import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideFriendsSuggestionsFeature } from './hide-friends-suggestions.js';

/** Блоки раздела друзей — страница «Друзья» хаба «Скрытие» в попапе. */
export function registerFriendsHiding(manager: FeatureManager): void {
  registerHideFriendsSuggestionsFeature(manager);
}
