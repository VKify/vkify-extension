import React from 'react';
import { useTranslation } from 'react-i18next';
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
export default function PlayerPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const hotkeysOn = useFeatureEnabled('media_player_hotkeys');
  const equalizerOn = useFeatureEnabled('audio_equalizer');

  const subpages: Subpage[] = [
    {
      id: 'hotkeys',
      title: t('player.hotkeys_title'),
      subtitle: t('player.hotkeys_desc'),
      icon: <KeyboardIcon className="w-5 h-5" />,
      iconColor: 'pink',
      anchors: ['media_player_hotkeys'],
      render: () => <PlayerHotkeysPage />,
    },
    {
      id: 'equalizer',
      title: t('player.eq_title'),
      subtitle: t('player.eq_desc'),
      icon: <EqualizerIcon className="w-5 h-5" />,
      iconColor: 'blue',
      anchors: ['audio_equalizer', 'audio_equalizer_preamp', 'audio_equalizer_bands', 'audio_equalizer_preset'],
      render: () => <EqualizerPage />,
    },
  ];

  return (
    <SubpageHost subpages={subpages}>
      <SettingsSection
        title={t('player.section')}
        description={t('player.section_desc')}
        icon={<MusicIcon className="w-5 h-5" />}
        iconColor="pink"
      >
        <NavRow
          subpage="hotkeys"
          title={t('player.hotkeys_title')}
          description={t('player.hotkeys_desc')}
          icon={<KeyboardIcon className="w-5 h-5" />}
          iconColor="pink"
          meta={hotkeysOn ? t('on') : t('off')}
        />
        <SectionDivider />
        <SettingRow
          id="audio_autoplay"
          title={t('player.autoplay_title')}
          description={t('player.autoplay_desc')}
          icon={<PlayIcon className="w-5 h-5" />}
          iconColor="green"
        />
        <SectionDivider />
        <NavRow
          subpage="equalizer"
          title={t('player.eq_title')}
          description={t('player.eq_desc')}
          icon={<EqualizerIcon className="w-5 h-5" />}
          iconColor="blue"
          meta={equalizerOn ? t('on') : t('off')}
        />
      </SettingsSection>
    </SubpageHost>
  );
}
