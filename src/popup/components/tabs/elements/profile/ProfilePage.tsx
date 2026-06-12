import React from 'react';
import ElementsSection from '../ElementsSection.js';
import { ProfileIcon, SmileIcon, StoryIcon } from '../../../icons/Icons.js';

/**
 * Страница «Профиль» хаба «Элементы» — элементы страниц пользователей.
 */
export default function ProfilePage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <ElementsSection
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
        ]}
      />
    </div>
  );
}
