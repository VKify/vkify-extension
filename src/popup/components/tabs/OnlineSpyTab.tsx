import React, { useMemo } from 'react';
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
      title: 'Активность в сообщениях',
      subtitle: 'Печать, голосовые, прочтение',
      icon: <EyeIcon className="w-5 h-5" />,
      iconColor: 'blue',
      anchors: ['spy_activity'],
      render: () => <div data-vkify-anchor="spy_activity"><ActivitySpySection lists={lists} asPage /></div>,
    },
    {
      id: 'online',
      title: 'Онлайн-мониторинг',
      subtitle: 'Заходы в сеть и графики',
      icon: <ActivityIcon className="w-5 h-5" />,
      iconColor: 'green',
      anchors: ['spy_online'],
      render: () => <div data-vkify-anchor="spy_online"><OnlineSpySection lists={lists} asPage /></div>,
    },
    {
      id: 'profile',
      title: 'Отслеживание профилей',
      subtitle: 'Аватар, статус, имя',
      icon: <UsersIcon className="w-5 h-5" />,
      iconColor: 'purple',
      anchors: ['profile_spy'],
      render: () => <div data-vkify-anchor="profile_spy"><ProfileSpySection lists={lists} asPage /></div>,
    },
  ], [lists]);

  return (
    <SubpageHost subpages={subpages}>
      <div className="space-y-4">
      <SettingsSection
        title="Слежка"
        description="Мониторинг активности пользователей VK"
        icon={<EyeIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <NavRow
          subpage="activity"
          title="Активность в сообщениях"
          description="Печать, голосовые, прочтение"
          icon={<EyeIcon className="w-5 h-5" />}
          iconColor="blue"
          meta={settings['spy_enabled'] === true ? 'Вкл' : 'Выкл'}
        />
        <div className="mx-3 border-t border-[var(--border-color)]" />
        <NavRow
          subpage="online"
          title="Онлайн-мониторинг"
          description="Заходы в сеть и графики"
          icon={<ActivityIcon className="w-5 h-5" />}
          iconColor="green"
          meta={settings['spy_online'] === true ? 'Вкл' : 'Выкл'}
        />
        <div className="mx-3 border-t border-[var(--border-color)]" />
        <NavRow
          subpage="profile"
          title="Отслеживание профилей"
          description="Аватар, статус, имя"
          icon={<UsersIcon className="w-5 h-5" />}
          iconColor="purple"
          meta={settings['profile_spy'] === true ? 'Вкл' : 'Выкл'}
        />
      </SettingsSection>

      <InfoBlock variant="info" icon={<InfoIcon className="w-4 h-4" />} title="Как это работает">
        Онлайн-мониторинг проверяет статус пользователей через VK API с выбранным интервалом.
        Данные о посещениях сохраняются в течение 7 дней для построения графиков активности.
      </InfoBlock>
      </div>
    </SubpageHost>
  );
}
