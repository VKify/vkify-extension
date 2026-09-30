import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { UserPlusIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Друзья» хаба «Скрытие» — блоки раздела друзей.
 */
export default function FriendsPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.friends')}
        elements={[
          {
            id: 'hide_friends_suggestions',
            title: t('items.hide_friends_suggestions.title'),
            description: t('items.hide_friends_suggestions.desc'),
            icon: <UserPlusIcon className="w-5 h-5" />,
            iconColor: 'blue',
          },
        ]}
      />
    </div>
  );
}
