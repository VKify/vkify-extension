import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import InfoBlock from '../ui/InfoBlock.js';
import SubpageHost, { type Subpage } from '../ui/SubpageHost.js';
import NavRow from '../ui/NavRow.js';
import SettingsSection from '../ui/SettingsSection.js';
import ActivitySpySection from './spySections/ActivitySpySection.js';
import OnlineSpySection from './spySections/OnlineSpySection.js';
import ProfileSpySection from './spySections/ProfileSpySection.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useFriends } from '../../hooks/features/useFriends.js';
import { useConversations } from '../../hooks/features/useConversations.js';
import { useVKifyStore } from '../../store/index.js';
import { EyeIcon, ActivityIcon, UsersIcon, InfoIcon } from '../icons/Icons.js';
import type { SpyLists } from './spySections/types.js';

export default function OnlineSpyTab(): React.ReactElement {
  const { t } = useTranslation('spy');
  const { hasToken, call } = useVKApi();
  const settings = useVKifyStore((s) => s.settings);

  // Друзья и диалоги грузятся один раз и переиспользуются всеми тремя
  // секциями (каждая открывает свою AddUserModal над общими списками).
  const friends = useFriends(hasToken, call);
  const conversations = useConversations(hasToken, call);
  const lists: SpyLists = { hasToken, friends, conversations };

  // Каждая слежка — функция с большим числом опций (списки, интервалы, логи,
  // графики), поэтому открывается на отдельной странице. Реестр строим внутри:
  // render-замыкания захватывают общий `lists`. Якорь живёт в теле подстраницы.
  const subpages = useMemo<Subpage[]>(() => [
    {
      id: 'activity',
      title: t('nav.activity.title'),
      subtitle: t('nav.activity.subtitle'),
      icon: <EyeIcon className="w-5 h-5" />,
      iconColor: 'blue',
      anchors: ['spy_activity'],
      render: () => <div data-vkify-anchor="spy_activity"><ActivitySpySection lists={lists} asPage /></div>,
    },
    {
      id: 'online',
      title: t('nav.online.title'),
      subtitle: t('nav.online.subtitle'),
      icon: <ActivityIcon className="w-5 h-5" />,
      iconColor: 'green',
      anchors: ['spy_online'],
      render: () => <div data-vkify-anchor="spy_online"><OnlineSpySection lists={lists} asPage /></div>,
    },
    {
      id: 'profile',
      title: t('nav.profile.title'),
      subtitle: t('nav.profile.subtitle'),
      icon: <UsersIcon className="w-5 h-5" />,
      iconColor: 'purple',
      anchors: ['profile_spy'],
      render: () => <div data-vkify-anchor="profile_spy"><ProfileSpySection lists={lists} asPage /></div>,
    },
  ], [lists, t]);

  return (
    <SubpageHost subpages={subpages}>
      <div className="space-y-4">
      <SettingsSection
        title={t('section')}
        description={t('section_desc')}
        icon={<EyeIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <NavRow
          subpage="activity"
          title={t('nav.activity.title')}
          description={t('nav.activity.subtitle')}
          icon={<EyeIcon className="w-5 h-5" />}
          iconColor="blue"
          meta={settings['spy_enabled'] === true ? t('on') : t('off')}
        />
        <div className="mx-3 border-t border-[var(--border-color)]" />
        <NavRow
          subpage="online"
          title={t('nav.online.title')}
          description={t('nav.online.subtitle')}
          icon={<ActivityIcon className="w-5 h-5" />}
          iconColor="green"
          meta={settings['spy_online'] === true ? t('on') : t('off')}
        />
        <div className="mx-3 border-t border-[var(--border-color)]" />
        <NavRow
          subpage="profile"
          title={t('nav.profile.title')}
          description={t('nav.profile.subtitle')}
          icon={<UsersIcon className="w-5 h-5" />}
          iconColor="purple"
          meta={settings['profile_spy'] === true ? t('on') : t('off')}
        />
      </SettingsSection>

      <InfoBlock variant="info" icon={<InfoIcon className="w-4 h-4" />} title={t('how_title')}>
        {t('how_body')}
      </InfoBlock>
      </div>
    </SubpageHost>
  );
}
