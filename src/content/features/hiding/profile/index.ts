import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideEmojiStatusFeature } from './hide-emoji-status.js';
import { hideOpenProfileBlockFeature } from './hide-open-profile-block.js';
import { hideProfileRightColumnFeature } from './hide-right-column.js';

/** Элементы страниц пользователей — страница «Профиль» хаба «Скрытие» в попапе. */
export function registerProfileHiding(manager: FeatureManager): void {
  manager.registerDefinitions([
    hideEmojiStatusFeature,
    hideOpenProfileBlockFeature,
    hideProfileRightColumnFeature,
  ]);
}
