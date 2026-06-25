import React from 'react';
import FeedPage from './feed/FeedPage.js';
import FriendsPage from './friends/FriendsPage.js';
import ProfilePage from './profile/ProfilePage.js';
import MenuPage from './menu/MenuPage.js';
import MusicPage from './music/MusicPage.js';
import CommunitiesPage from './communities/CommunitiesPage.js';
import MessengerPage from './messenger/MessengerPage.js';
import GlobalPage from './global/GlobalPage.js';
import {
  FeedIcon,
  FriendsIcon,
  ProfileIcon,
  MenuSectionIcon,
  MusicSectionIcon,
  CommunitiesIcon,
  MessengerIcon,
  GlobeIcon,
} from '../../icons/Icons.js';

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

// Порядок страниц повторяет реальное левое меню ВК (Профиль → Лента →
// Мессенджер → Друзья → Сообщества → Музыка); «Меню» (само боковое меню) и
// «Глобально» (сквозные элементы) — это не пункты меню, поэтому идут в конце.
export const ELEMENTS_PAGES: ElementsPage[] = [
  {
    id: 'profile',
    label: 'Профиль',
    icon: ProfileIcon,
    component: ProfilePage,
    anchors: ['hide_emoji_status', 'hide_stories_discover', 'hide_promo_link', 'hide_profile_right_column'],
  },
  {
    id: 'feed',
    label: 'Лента',
    icon: FeedIcon,
    component: FeedPage,
    anchors: ['hide_stories', 'hide_post_box', 'hide_post_comments'],
  },
  {
    id: 'messenger',
    label: 'Мессенджер',
    icon: MessengerIcon,
    component: MessengerPage,
    anchors: ['hide_recommended_channels'],
  },
  {
    id: 'friends',
    label: 'Друзья',
    icon: FriendsIcon,
    component: FriendsPage,
    anchors: ['hide_friends_suggestions'],
  },
  {
    id: 'communities',
    label: 'Сообщества',
    icon: CommunitiesIcon,
    component: CommunitiesPage,
    anchors: ['hide_recent_groups'],
  },
  {
    id: 'music',
    label: 'Музыка',
    icon: MusicSectionIcon,
    component: MusicPage,
    anchors: ['hide_audio_ads'],
  },
  {
    id: 'menu',
    label: 'Меню',
    icon: MenuSectionIcon,
    component: MenuPage,
    anchors: ['hidden_menu_items', 'hide_menu_settings', 'hide_menu_counters'],
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
      'hide_auth_popup',
    ],
  },
];

/** Страница хаба, на которой расположен якорь (или undefined для чужих). */
export function pageForAnchor(anchor: string): ElementsPage | undefined {
  return ELEMENTS_PAGES.find(p => p.anchors.includes(anchor));
}
