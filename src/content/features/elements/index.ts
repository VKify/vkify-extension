import type { FeatureManager } from '../../core/feature-manager.js';
import { registerFeedElements } from './feed/index.js';
import { registerFriendsElements } from './friends/index.js';
import { registerProfileElements } from './profile/index.js';
import { registerGlobalElements } from './global/index.js';

/**
 * Фичи хаба «Элементы» — зеркалит структуру одноимённой вкладки попапа
 * (как «Центр»): каждая подпапка соответствует странице хаба
 * (feed → «Лента», friends → «Друзья», profile → «Профиль»,
 * global → «Глобально»). Новая страница хаба = новая подпапка + регистрация
 * здесь.
 */
export function registerElementsFeatures(manager: FeatureManager): void {
  registerFeedElements(manager);
  registerFriendsElements(manager);
  registerProfileElements(manager);
  registerGlobalElements(manager);
}
