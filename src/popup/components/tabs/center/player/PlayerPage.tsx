import React from 'react';
import SubpageHost, { type Subpage } from '../../../ui/SubpageHost.js';
import NavRow from '../../../ui/NavRow.js';
import SettingsSection from '../../../ui/SettingsSection.js';
import PlayerHotkeysPage from './PlayerHotkeysPage.js';
import { useSettings } from '../../../../context/SettingsContext.js';
import { MusicIcon, KeyboardIcon } from '../../../icons/Icons.js';

/**
 * Страница «Плеер» хаба «Центр». Сейчас одна функция — управление с клавиатуры,
 * — но она вынесена на собственную подстраницу (SubpageHost → DetailPage), так
 * как страница планируется расширять новыми функциями плеера. Новая функция =
 * одна запись в `SUBPAGES` + один `NavRow`, без переписывания страницы.
 */
const SUBPAGES: Subpage[] = [
  {
    id: 'hotkeys',
    title: 'Управление с клавиатуры',
    subtitle: 'Хоткеи плеера VK',
    icon: <KeyboardIcon className="w-5 h-5" />,
    iconColor: 'pink',
    anchors: ['media_player_hotkeys'],
    render: () => <PlayerHotkeysPage />,
  },
];

export default function PlayerPage(): React.ReactElement {
  const { settings } = useSettings();

  return (
    <SubpageHost subpages={SUBPAGES}>
      <SettingsSection
        title="Плеер"
        description="Аудиоплеер ВКонтакте"
        icon={<MusicIcon className="w-5 h-5" />}
        iconColor="pink"
      >
        <NavRow
          subpage="hotkeys"
          title="Управление с клавиатуры"
          description="Хоткеи плеера VK"
          icon={<KeyboardIcon className="w-5 h-5" />}
          iconColor="pink"
          meta={settings['media_player_hotkeys'] === true ? 'Вкл' : 'Выкл'}
        />
      </SettingsSection>
    </SubpageHost>
  );
}
