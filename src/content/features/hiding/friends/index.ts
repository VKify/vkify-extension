import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideFriendsSuggestionsFeature } from './hide-friends-suggestions.js';

/** Блоки раздела друзей — страница «Друзья» хаба «Скрытие» в попапе. */
export function registerFriendsHiding(manager: FeatureManager): void {
  manager.registerDefinition(hideFriendsSuggestionsFeature);
}
