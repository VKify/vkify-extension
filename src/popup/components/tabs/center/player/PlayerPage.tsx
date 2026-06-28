import React from 'react';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import PlayerHotkeysPage from './PlayerHotkeysPage.js';
import EqualizerPage from './EqualizerPage.js';
import { useFeatureEnabled } from '@/popup/store/selectors.js';
import { MusicIcon, KeyboardIcon, PlayIcon, InfoIcon, EqualizerIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Плеер» хаба «Центр». «Управление с клавиатуры» — отдельная подстраница
 * (много хоткеев), «Автозапуск после перезагрузки» — простой тумблер прямо на
 * странице (опций нет). Новая функция плеера = ещё один NavRow/SettingRow здесь.
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
  {
    id: 'equalizer',
    title: 'Эквалайзер',
    subtitle: '10 полос частот и пресеты',
    icon: <EqualizerIcon className="w-5 h-5" />,
    iconColor: 'blue',
    anchors: ['audio_equalizer', 'audio_equalizer_preamp', 'audio_equalizer_bands', 'audio_equalizer_preset'],
    render: () => <EqualizerPage />,
  },
];

export default function PlayerPage(): React.ReactElement {
  const hotkeysOn = useFeatureEnabled('media_player_hotkeys');
  const equalizerOn = useFeatureEnabled('audio_equalizer');

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
          meta={hotkeysOn ? 'Вкл' : 'Выкл'}
        />
        <SectionDivider />
        <SettingRow
          id="audio_autoplay"
          title="Автозапуск после перезагрузки"
          description="Продолжить трек после обновления страницы"
          icon={<PlayIcon className="w-5 h-5" />}
          iconColor="green"
        />
        <SectionDivider />
        <NavRow
          subpage="equalizer"
          title="Эквалайзер"
          description="10 полос частот и пресеты"
          icon={<EqualizerIcon className="w-5 h-5" />}
          iconColor="blue"
          meta={equalizerOn ? 'Вкл' : 'Выкл'}
        />
      </SettingsSection>
    </SubpageHost>
  );
}
