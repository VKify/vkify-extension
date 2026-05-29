import React from 'react';
import MessagesPage from './MessagesPage.js';
import { MessageIcon } from '../../icons/Icons.js';

/**
 * Реестр страниц хаба «Центр». Шелл (HubTab) рендерит навигацию и активную
 * страницу отсюда — добавление будущего раздела это одна новая запись + один
 * компонент страницы, без изменений самого хаба.
 *
 * Пока готова ОДНА страница — «Сообщения». Остальные разделы в разработке и
 * намеренно не заведены (в рейле показывается заглушка «Скоро»).
 */
export interface HubPage {
  /** id страницы (для состояния навигации). */
  id: string;
  /** Короткая подпись в рейле. */
  label: string;
  /** Иконка раздела. */
  icon: React.ComponentType<{ className?: string }>;
  /** Контент страницы. */
  component: React.ComponentType;
}

export const HUB_PAGES: HubPage[] = [
  { id: 'messages', label: 'Сообщения', icon: MessageIcon, component: MessagesPage },
];
