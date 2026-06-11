import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerHideFriendsSuggestionsFeature } from './hide-friends-suggestions.js';

/** Блоки раздела друзей — страница «Друзья» хаба «Элементы» в попапе. */
export function registerFriendsElements(manager: FeatureManager): void {
  registerHideFriendsSuggestionsFeature(manager);
}
