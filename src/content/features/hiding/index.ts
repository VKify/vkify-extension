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

  // Все «элементы» — лёгкое точечное скрытие через статический colocated-CSS
  // (маркер data-vkify-<id>), без observer'ов → impact light, requiresDomLayer false.
  manager.describeFeatures({
    hide_stories:               { name: 'Скрыть истории',                 category: 'hiding' },
    hide_post_box:              { name: 'Скрыть поле записи',             category: 'hiding' },
    hide_post_comments:         { name: 'Скрыть комментарии',            category: 'hiding' },
    hide_feed_right_column:     { name: 'Скрыть правую колонку ленты',    category: 'hiding' },
    hide_friends_suggestions:   { name: 'Скрыть «возможные друзья»',     category: 'hiding' },
    hide_promo_link:            { name: 'Скрыть промо-ссылку',           category: 'hiding' },
    hide_stories_discover:      { name: 'Скрыть Discover историй',       category: 'hiding' },
    hide_emoji_status:          { name: 'Скрыть эмодзи-статус',          category: 'hiding' },
    hide_profile_right_column:   { name: 'Скрыть правую колонку профиля',  category: 'hiding' },
    hide_menu_settings:         { name: 'Скрыть «Настройки» в меню',     category: 'hiding' },
    hide_menu_counters:         { name: 'Скрыть счётчики меню',          category: 'hiding' },
    hide_audio_ads:             { name: 'Скрыть аудиорекламу',           category: 'hiding' },
    hide_recent_groups:         { name: 'Скрыть недавние сообщества',    category: 'hiding' },
    hide_recommended_channels:  { name: 'Скрыть рекомендованные каналы', category: 'hiding' },
    hide_recommendations:       { name: 'Скрыть рекомендации',           category: 'hiding' },
    hide_scroll_top:            { name: 'Скрыть кнопку «наверх»',        category: 'hiding' },
    hide_mini_chat:             { name: 'Скрыть мини-чат',               category: 'hiding' },
    hide_auth_popup:            { name: 'Скрыть попап авторизации',      category: 'hiding' },
  });
}
