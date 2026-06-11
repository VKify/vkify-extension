import React from 'react';
import FeedPage from './feed/FeedPage.js';
import FriendsPage from './friends/FriendsPage.js';
import ProfilePage from './profile/ProfilePage.js';
import GlobalPage from './global/GlobalPage.js';
import { LayoutRowsIcon, UsersIcon, SmileIcon, GlobeIcon } from '../../icons/Icons.js';

/**
 * Реестр страниц хаба «Элементы» — та же архитектура, что у хаба «Центр»
 * (см. ../center/pages.tsx): шелл (ElementsTab) рендерит навигацию и активную
 * страницу отсюда, добавление раздела = одна запись + подпапка с компонентами.
 *
 * `anchors` — id якорей поиска (data-vkify-anchor), живущих на странице:
 * по ним Ctrl+K открывает нужный раздел хаба (см. utils/pendingAnchor.ts).
 */
export interface ElementsPage {
  /** id страницы (для состояния навигации). */
  id: string;
  /** Короткая подпись в рейле. */
  label: string;
  /** Иконка раздела. */
  icon: React.ComponentType<{ className?: string }>;
  /** Контент страницы. */
  component: React.ComponentType;
  /** Якоря поиска, расположенные на этой странице. */
  anchors: readonly string[];
}

export const ELEMENTS_PAGES: ElementsPage[] = [
  {
    id: 'feed',
    label: 'Лента',
    icon: LayoutRowsIcon,
    component: FeedPage,
    anchors: ['hide_stories'],
  },
  {
    id: 'friends',
    label: 'Друзья',
    icon: UsersIcon,
    component: FriendsPage,
    anchors: ['hide_friends_suggestions'],
  },
  {
    id: 'profile',
    label: 'Профиль',
    icon: SmileIcon,
    component: ProfilePage,
    anchors: ['hide_emoji_status'],
  },
  {
    id: 'global',
    label: 'Глобально',
    icon: GlobeIcon,
    component: GlobalPage,
    anchors: [
      'hide_recommendations',
      'hide_mini_chat',
      'hide_scroll_top',
      'hide_menu_settings',
      'hide_auth_popup',
    ],
  },
];

/** Страница хаба, на которой расположен якорь (или undefined для чужих). */
export function pageForAnchor(anchor: string): ElementsPage | undefined {
  return ELEMENTS_PAGES.find(p => p.anchors.includes(anchor));
}
