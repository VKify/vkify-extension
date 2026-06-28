import type { FeatureManager } from '../../core/feature-manager.js';
import { registerFeedHiding } from './feed/index.js';
import { registerFriendsHiding } from './friends/index.js';
import { registerProfileHiding } from './profile/index.js';
import { registerMenuHiding } from './menu/index.js';
import { registerMusicHiding } from './music/index.js';
import { registerCommunitiesHiding } from './communities/index.js';
import { registerMessengerHiding } from './messenger/index.js';
import { registerGlobalHiding } from './global/index.js';

/**
 * Фичи хаба «Скрытие» — зеркалит структуру одноимённой вкладки попапа
 * (как «Центр»): каждая подпапка соответствует странице хаба
 * (feed → «Лента», friends → «Друзья», profile → «Профиль», menu → «Меню»,
 * music → «Музыка», communities → «Сообщества», messenger → «Мессенджер»,
 * global → «Глобально»). Новая страница хаба = новая подпапка + регистрация
 * здесь.
 */
export function registerHidingFeatures(manager: FeatureManager): void {
  registerFeedHiding(manager);
  registerFriendsHiding(manager);
  registerProfileHiding(manager);
  registerMenuHiding(manager);
  registerMusicHiding(manager);
  registerCommunitiesHiding(manager);
  registerMessengerHiding(manager);
  registerGlobalHiding(manager);

  // Все «элементы» — декларативные плагинные фичи (cssFeature), их метадата
  // живёт в собственных файлах.
}
