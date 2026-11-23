import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { SmileIcon, SidebarIcon, LockIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Профиль» хаба «Скрытие» — элементы страниц пользователей.
 */
export default function ProfilePage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.profile')}
        elements={[
          {
            id: 'hide_emoji_status',
            title: t('items.hide_emoji_status.title'),
            description: t('items.hide_emoji_status.desc'),
            icon: <SmileIcon className="w-5 h-5" />,
          },
          {
            id: 'hide_open_profile_block',
            title: t('items.hide_open_profile_block.title'),
            description: t('items.hide_open_profile_block.desc'),
            icon: <LockIcon className="w-5 h-5" />,
          },
          {
            id: 'hide_profile_right_column',
            title: t('items.hide_profile_right_column.title'),
            description: t('items.hide_profile_right_column.desc'),
            icon: <SidebarIcon className="w-5 h-5" />,
          },
        ]}
      />
    </div>
  );
}
