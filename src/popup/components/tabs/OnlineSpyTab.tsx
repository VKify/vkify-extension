import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SubpageHost, { type Subpage, useSubpageNav } from '../ui/SubpageHost.js';
import {
  DashboardHero, DashboardHeroImage, DashboardNavItem, DashboardPanel, DashboardSettingCard,
} from '../ui/DashboardPrimitives.js';
import ActivitySpySection from './spySections/ActivitySpySection.js';
import OnlineSpySection from './spySections/OnlineSpySection.js';
import ProfileSpySection from './spySections/ProfileSpySection.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useFriends } from '../../hooks/features/useFriends.js';
import { useConversations } from '../../hooks/features/useConversations.js';
import { useVKifyStore } from '../../store/index.js';
import { EyeIcon, ActivityIcon, UsersIcon, InfoIcon } from '../icons/Icons.js';
import type { SpyLists } from './spySections/types.js';

function SpyOverview(): React.ReactElement {
  const { t } = useTranslation('spy');
  const { open } = useSubpageNav();
  const settings = useVKifyStore(state => state.settings);

  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('section')} subtitle={t('hero_subtitle')} description={t('hero_description')}
      artwork={<DashboardHeroImage src="/assets/dashboard/spy-hero.png" />} />

    <DashboardPanel title={t('modes_title')} description={t('modes_description')}
      icon={<ActivityIcon className="h-5 w-5" />} className="pb-4">
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
        <DashboardNavItem title={t('nav.activity.title')} description={t('nav.activity.subtitle')}
          icon={<EyeIcon className="h-5 w-5" />} docsId="spy_activity" tone="primary"
          onClick={() => open('activity')} meta={settings['spy_enabled'] === true ? t('on') : t('off')} />
        <DashboardNavItem title={t('nav.online.title')} description={t('nav.online.subtitle')}
          icon={<ActivityIcon className="h-5 w-5" />} docsId="spy_online" tone="success"
          onClick={() => open('online')} meta={settings['spy_online'] === true ? t('on') : t('off')} />
        <DashboardNavItem title={t('nav.profile.title')} description={t('nav.profile.subtitle')}
          icon={<UsersIcon className="h-5 w-5" />} docsId="profile_spy" tone="violet"
          onClick={() => open('profile')} meta={settings['profile_spy'] === true ? t('on') : t('off')} />
      </div>
    </DashboardPanel>

    <DashboardSettingCard icon={<InfoIcon className="h-5 w-5" />} title={t('how_title')}
      description={t('how_body')} />
  </div>;
}

export default function OnlineSpyTab(): React.ReactElement {
  const { t } = useTranslation('spy');
  const { hasToken, call } = useVKApi();

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
      <SpyOverview />
    </SubpageHost>
  );
}
