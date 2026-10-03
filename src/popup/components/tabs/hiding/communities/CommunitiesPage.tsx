import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { RecentIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Сообщества» хаба «Скрытие» — элементы раздела групп.
 */
export default function CommunitiesPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.communities')}
        elements={[
          {
            id: 'hide_recent_groups',
            title: t('items.hide_recent_groups.title'),
            description: t('items.hide_recent_groups.desc'),
            icon: <RecentIcon className="w-5 h-5" />,
          },
        ]}
      />
    </div>
  );
}
