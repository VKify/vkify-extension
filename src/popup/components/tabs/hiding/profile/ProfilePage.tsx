import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { ProfileIcon, SmileIcon, StoryIcon, AdIcon, SidebarIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Профиль» хаба «Скрытие» — элементы страниц пользователей.
 */
export default function ProfilePage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.profile')}
        subtitle={t('subtitle.profile')}
        icon={<ProfileIcon className="w-5 h-5 text-pink-500" />}
        iconBg="bg-pink-500/10"
        elements={[
          {
            id: 'hide_emoji_status',
            title: t('items.hide_emoji_status.title'),
            description: t('items.hide_emoji_status.desc'),
            icon: <SmileIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
          {
            id: 'hide_stories_discover',
            title: t('items.hide_stories_discover.title'),
            description: t('items.hide_stories_discover.desc'),
            icon: <StoryIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
          {
            id: 'hide_promo_link',
            title: t('items.hide_promo_link.title'),
            description: t('items.hide_promo_link.desc'),
            icon: <AdIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
          {
            id: 'hide_profile_right_column',
            title: t('items.hide_profile_right_column.title'),
            description: t('items.hide_profile_right_column.desc'),
            icon: <SidebarIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
        ]}
      />
    </div>
  );
}
