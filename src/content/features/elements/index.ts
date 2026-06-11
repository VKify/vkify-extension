import type { FeatureManager } from '../../core/feature-manager.js';
import { registerFeedElements } from './feed/index.js';
import { registerFriendsElements } from './friends/index.js';
import { registerProfileElements } from './profile/index.js';
import { registerMenuElements } from './menu/index.js';
import { registerMusicElements } from './music/index.js';
import { registerCommunitiesElements } from './communities/index.js';
import { registerMessengerElements } from './messenger/index.js';
import { registerGlobalElements } from './global/index.js';

/**
 * Фичи хаба «Элементы» — зеркалит структуру одноимённой вкладки попапа
 * (как «Центр»): каждая подпапка соответствует странице хаба
 * (feed → «Лента», friends → «Друзья», profile → «Профиль», menu → «Меню»,
 * music → «Музыка», communities → «Сообщества», messenger → «Мессенджер»,
 * global → «Глобально»). Новая страница хаба = новая подпапка + регистрация
 * здесь.
 */
export function registerElementsFeatures(manager: FeatureManager): void {
  registerFeedElements(manager);
  registerFriendsElements(manager);
  registerProfileElements(manager);
  registerMenuElements(manager);
  registerMusicElements(manager);
  registerCommunitiesElements(manager);
  registerMessengerElements(manager);
  registerGlobalElements(manager);
}
