import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import SubpageHost from '@/popup/components/ui/SubpageHost.js';
import SubscriptionsPage from './SubscriptionsPage.js';
import GroupParserPage from './GroupParserPage.js';
import { MoveHorizontalIcon, ChevronRightIcon, CommunitiesIcon, GlobeIcon, SidebarIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Сообщества» хаба «Центр» — настройки внешнего вида страницы
 * сообщества VK.
 */
export default function CommunitiesPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <SubpageHost subpages={[{ id: 'subscriptions-overview', title: t('subscriptions.title'), subtitle: t('subscriptions.description'),
      icon: <CommunitiesIcon className="w-5 h-5" />, anchors: ['subscriptions-overview'], render: () => <SubscriptionsPage /> },
      { id: 'group-members-parser', title: t('parser.title'), icon: <CommunitiesIcon className="w-5 h-5" />,
        anchors: ['group-members-parser'], render: () => <GroupParserPage /> }]}>
    <div className="space-y-4">
      <SettingsSection title={t('tools.api_title')} description={t('tools.communities_api_desc')}
        icon={<GlobeIcon className="w-5 h-5" />} className="ct-api-section">
        <NavRow subpage="subscriptions-overview" title={t('subscriptions.title')} description={t('subscriptions.description')}
          icon={<CommunitiesIcon className="w-5 h-5" />} />
        <NavRow subpage="group-members-parser" title={t('parser.title')} description={t('parser.description')}
          icon={<CommunitiesIcon className="w-5 h-5" />} />
      </SettingsSection>
      <SettingsSection title={t('communities.layout_title')} description={t('communities.layout_desc')}
        icon={<SidebarIcon className="w-5 h-5" />}>
        <SettingRow
          id="communities_swap_columns"
          title={t('communities.swap_title')}
          description={t('communities.swap_desc')}
          icon={<MoveHorizontalIcon className="w-5 h-5" />}
        />
        <SettingRow
          id="communities_my_groups_redirect"
          title={t('communities.redirect_title')}
          description={t('communities.redirect_desc')}
          icon={<ChevronRightIcon className="w-5 h-5" />}
        />
      </SettingsSection>
    </div>
    </SubpageHost>
  );
}
