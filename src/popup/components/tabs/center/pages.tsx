import React from 'react';
import MessagesPage from './messages/MessagesPage.js';
import PlayerPage from './player/PlayerPage.js';
import FeedPage from './feed/FeedPage.js';
import { MessengerIcon, MusicIcon, FeedIcon } from '../../icons/Icons.js';

/**
 * Реестр страниц хаба «Центр». Шелл (CenterTab) рендерит навигацию и активную
 * страницу отсюда — добавление будущего раздела это одна новая запись + одна
 * подпапка с компонентами страницы, без изменений самого хаба.
 *
 * `anchors` — id якорей поиска (data-vkify-anchor), живущих на странице:
 * по ним Ctrl+K открывает нужный раздел хаба (см. utils/pendingAnchor.ts).
 */
export interface CenterPage {
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

export const CENTER_PAGES: CenterPage[] = [
  {
    id: 'messages',
    label: 'Сообщения',
    icon: MessengerIcon,
    component: MessagesPage,
    anchors: [
      'message_quick_copy',
      'dialog_export_enabled',
      'message_pin_notes',
      'message_templates_enabled',
      'message_templates_trigger_slash',
      'message_templates_trigger_hotkey',
      'message_templates_trigger_autocomplete',
      'message_templates_auto_send',
    ],
  },
  {
    id: 'player',
    label: 'Плеер',
    icon: MusicIcon,
    component: PlayerPage,
    anchors: ['media_player_hotkeys'],
  },
  {
    id: 'feed',
    label: 'Лента',
    icon: FeedIcon,
    component: FeedPage,
    anchors: ['expand_post_text'],
  },
];

/** Страница хаба, на которой расположен якорь (или undefined для чужих). */
export function pageForAnchor(anchor: string): CenterPage | undefined {
  return CENTER_PAGES.find(p => p.anchors.includes(anchor));
}
