import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerHideEmojiStatusFeature } from './hide-emoji-status.js';

/** Элементы страниц пользователей — страница «Профиль» хаба «Элементы» в попапе. */
export function registerProfileElements(manager: FeatureManager): void {
  registerHideEmojiStatusFeature(manager);
}
