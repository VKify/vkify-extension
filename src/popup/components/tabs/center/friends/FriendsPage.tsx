import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import { FriendsIcon, StatisticsIcon, UserPlusIcon } from '@/popup/components/icons/Icons.js';
import FriendsAuditPage from './FriendsAuditPage.js';
import AutoAddFriendsPage from './AutoAddFriendsPage.js';

export default function FriendsPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const { t: automation } = useTranslation('automation');
  const subpages: Subpage[] = [{
    id: 'friends-audit', title: t('friends.title'), subtitle: t('friends.nav_description'),
    icon: <StatisticsIcon className="w-5 h-5" />, iconColor: 'cyan',
    anchors: ['friends_audit'], render: () => <FriendsAuditPage />,
  }, {
    id: 'autoadd', title: automation('autoadd.title'), subtitle: automation('autoadd.subtitle'),
    icon: <UserPlusIcon className="w-5 h-5" />, iconColor: 'green',
    anchors: ['auto_add_friends'], render: () => <AutoAddFriendsPage />,
  }];
  return <SubpageHost subpages={subpages}>
    <SettingsSection title={t('friends.tools_title')} description={t('friends.tools_description')}
      icon={<FriendsIcon className="w-5 h-5" />} iconColor="cyan">
      <NavRow subpage="friends-audit" title={t('friends.title')} docsId="friends_audit"
        description={t('friends.nav_description')} icon={<StatisticsIcon className="w-5 h-5" />} iconColor="cyan" />
      <NavRow subpage="autoadd" title={automation('autoadd.title')} docsId="auto_add_friends"
        description={automation('autoadd.subtitle')} icon={<UserPlusIcon className="w-5 h-5" />} iconColor="green" />
    </SettingsSection>
  </SubpageHost>;
}
