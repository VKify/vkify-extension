import React from 'react';
import ElementsSection from '../ElementsSection.js';
import { FriendsIcon, UserPlusIcon } from '../../../icons/Icons.js';

/**
 * Страница «Друзья» хаба «Элементы» — блоки раздела друзей.
 */
export default function FriendsPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <ElementsSection
        title="Друзья"
        subtitle="Блоки раздела друзей"
        icon={<FriendsIcon className="w-5 h-5 text-blue-500" />}
        iconBg="bg-blue-500/10"
        elements={[
          {
            id: 'hide_friends_suggestions',
            title: 'Возможные друзья',
            description: 'Блок с предложениями дружбы',
            icon: <UserPlusIcon className="w-5 h-5" />,
            iconColor: 'blue',
          },
        ]}
      />
    </div>
  );
}
