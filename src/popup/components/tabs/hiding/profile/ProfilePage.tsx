import React from 'react';
import HidingSection from '../HidingSection.js';
import { ProfileIcon, SmileIcon, StoryIcon, AdIcon, SidebarIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Профиль» хаба «Скрытие» — элементы страниц пользователей.
 */
export default function ProfilePage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <HidingSection
        title="Профиль"
        subtitle="Элементы страниц пользователей"
        icon={<ProfileIcon className="w-5 h-5 text-pink-500" />}
        iconBg="bg-pink-500/10"
        elements={[
          {
            id: 'hide_emoji_status',
            title: 'Эмодзи-статусы',
            description: 'Статусы с эмодзи у пользователей',
            icon: <SmileIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
          {
            id: 'hide_stories_discover',
            title: 'Истории возможных друзей',
            description: 'Блок историй возможных друзей на профиле',
            icon: <StoryIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
          {
            id: 'hide_promo_link',
            title: 'Промо-блок',
            description: 'Рекламная ссылка на мини-приложение',
            icon: <AdIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
          {
            id: 'hide_profile_right_column',
            title: 'Правая колонка',
            description: 'Колонка с друзьями, подписками и пр.',
            icon: <SidebarIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
        ]}
      />
    </div>
  );
}
