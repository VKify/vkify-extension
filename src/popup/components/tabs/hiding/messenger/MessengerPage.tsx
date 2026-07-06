import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { MessengerIcon, HashtagIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Мессенджер» хаба «Скрытие» — элементы раздела сообщений.
 */
export default function MessengerPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.messenger')}
        subtitle={t('subtitle.messenger')}
        icon={<MessengerIcon className="w-5 h-5 text-blue-500" />}
        iconBg="bg-blue-500/10"
        elements={[
          {
            id: 'hide_recommended_channels',
            title: 'Рекомендуемые каналы',
            description: 'Блок рекомендаций каналов',
            icon: <HashtagIcon className="w-5 h-5" />,
            iconColor: 'blue',
          },
        ]}
      />
    </div>
  );
}
