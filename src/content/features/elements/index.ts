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

  // Все «элементы» — лёгкое точечное скрытие через статический colocated-CSS
  // (маркер data-vkify-<id>), без observer'ов → impact light, requiresDomLayer false.
  manager.describeFeatures({
    hide_stories:               { name: 'Скрыть истории',                 category: 'elements' },
    hide_post_box:              { name: 'Скрыть поле записи',             category: 'elements' },
    hide_post_comments:         { name: 'Скрыть комментарии',            category: 'elements' },
    hide_friends_suggestions:   { name: 'Скрыть «возможные друзья»',     category: 'elements' },
    hide_promo_link:            { name: 'Скрыть промо-ссылку',           category: 'elements' },
    hide_stories_discover:      { name: 'Скрыть Discover историй',       category: 'elements' },
    hide_emoji_status:          { name: 'Скрыть эмодзи-статус',          category: 'elements' },
    hide_menu_settings:         { name: 'Скрыть «Настройки» в меню',     category: 'elements' },
    hide_menu_counters:         { name: 'Скрыть счётчики меню',          category: 'elements' },
    hide_audio_ads:             { name: 'Скрыть аудиорекламу',           category: 'elements' },
    hide_recent_groups:         { name: 'Скрыть недавние сообщества',    category: 'elements' },
    hide_recommended_channels:  { name: 'Скрыть рекомендованные каналы', category: 'elements' },
    hide_recommendations:       { name: 'Скрыть рекомендации',           category: 'elements' },
    hide_scroll_top:            { name: 'Скрыть кнопку «наверх»',        category: 'elements' },
    hide_mini_chat:             { name: 'Скрыть мини-чат',               category: 'elements' },
    hide_auth_popup:            { name: 'Скрыть попап авторизации',      category: 'elements' },
  });
}
