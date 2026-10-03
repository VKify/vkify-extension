import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { HashtagIcon, BellIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Мессенджер» хаба «Скрытие» — элементы раздела сообщений.
 */
export default function MessengerPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.messenger')}
        elements={[
          {
            id: 'hide_recommended_channels',
            title: t('items.hide_recommended_channels.title'),
            description: t('items.hide_recommended_channels.desc'),
            icon: <HashtagIcon className="w-5 h-5" />,
          },
          {
            id: 'hide_channels_tab',
            title: t('items.hide_channels_tab.title'),
            description: t('items.hide_channels_tab.desc'),
            icon: <HashtagIcon className="w-5 h-5" />,
          },
          {
            id: 'hide_business_notifications',
            title: t('items.hide_business_notifications.title'),
            description: t('items.hide_business_notifications.desc'),
            icon: <BellIcon className="w-5 h-5" />,
          },
        ]}
      />
    </div>
  );
}
