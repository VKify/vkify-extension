import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { CommunitiesIcon, RecentIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Сообщества» хаба «Скрытие» — элементы раздела групп.
 */
export default function CommunitiesPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.communities')}
        subtitle={t('subtitle.communities')}
        icon={<CommunitiesIcon className="w-5 h-5 text-green-500" />}
        iconBg="bg-green-500/10"
        elements={[
          {
            id: 'hide_recent_groups',
            title: 'Недавние группы',
            description: 'Блок недавно посещённых сообществ',
            icon: <RecentIcon className="w-5 h-5" />,
            iconColor: 'green',
          },
        ]}
      />
    </div>
  );
}
