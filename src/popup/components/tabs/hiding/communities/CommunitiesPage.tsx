import React from 'react';
import HidingSection from '../HidingSection.js';
import { CommunitiesIcon, RecentIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Сообщества» хаба «Скрытие» — элементы раздела групп.
 */
export default function CommunitiesPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <HidingSection
        title="Сообщества"
        subtitle="Элементы раздела групп"
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
