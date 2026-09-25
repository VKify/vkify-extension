import { LYRICS_DEFAULTS, parseLyricsSettings } from '@/shared/music-lyrics.js';
import MusicLyricsPage from './MusicLyricsPage.js';
import React, { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import AudioDownloadPage from './AudioDownloadPage.js';
import AudioUploadPage from './AudioUploadPage.js';
import MusicVisualizerPage from './MusicVisualizerPage.js';
import ResetButton from '@/popup/components/ui/ResetButton.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { parseVisualizerSettings, VISUALIZER_DEFAULTS } from '@/shared/music-visualizer.js';
import { useFeatureEnabled } from '@/popup/store/selectors.js';
import { MusicSectionIcon, UploadIcon } from '@/popup/components/icons/Icons.js';
import MusicHotkeysPage from './MusicHotkeysPage.js';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { KeyboardIcon, PlayIcon, InfoIcon, EqualizerIcon } from '@/popup/components/icons/Icons.js';
import { BROWSER, IS_FIREFOX } from '@/shared/constants/browser.js';
import { openTab } from '@/popup/utils/tabs.js';

const EqualizerPage = lazy(() => import('./EqualizerPage.js'));

function MusicResetButton({ lyrics = false }: { lyrics?: boolean }): React.ReactElement | null {
  const { t } = useTranslation('center');
  const key = lyrics ? 'music_lyrics_settings' : 'music_visualizer_settings';
  const defaults = lyrics ? LYRICS_DEFAULTS : VISUALIZER_DEFAULTS;
  const raw = useVKifyStore((s) => s.settings[key]);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const current = lyrics ? parseLyricsSettings(raw) : parseVisualizerSettings(raw);
  if (Object.entries(defaults).every(([key, value]) => current[key as keyof typeof current] === value)) return null;
  return <ResetButton aria-label={t('music.visualizer.reset_all')} onClick={() => { void saveSetting(key, JSON.stringify(defaults)); }} />;
}

/**
 * Единая страница всей музыкальной функциональности. Главный экран разделён на
 * смысловые блоки, а функции с большим числом опций открываются в подстраницах.
 */
export default function MusicPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const audioDownloadOn = useFeatureEnabled('audio_download');
  const audioUploadOn = useFeatureEnabled('audio_multi_upload');
  const visualizerOn = useFeatureEnabled('music_visualizer');
  const lyricsOn = useFeatureEnabled('music_lyrics');
  const hotkeysOn = useFeatureEnabled('media_player_hotkeys');
  const equalizerOn = useFeatureEnabled('audio_equalizer');
  const autoplayOn = useFeatureEnabled('audio_autoplay');

  const subpages: Subpage[] = [
    {
      id: 'download',
      title: t('music.download_title'),
      subtitle: t('music.download_subtitle'),
      icon: <MusicSectionIcon className="w-5 h-5" />,
      iconColor: 'pink',
      anchors: ['audio_download', 'audio_download_id3', 'audio_download_lyrics', 'audio_download_bitrate', 'audio_download_filename'],
      render: () => <AudioDownloadPage />,
    },
    {
      id: 'hotkeys',
      title: t('player.hotkeys_title'),
      subtitle: t('player.hotkeys_desc'),
      icon: <KeyboardIcon className="w-5 h-5" />,
      iconColor: 'pink',
      anchors: ['media_player_hotkeys'],
      render: () => <MusicHotkeysPage />,
    },
    {
      id: 'equalizer',
      title: t('player.eq_title'),
      subtitle: t('player.eq_desc'),
      icon: <EqualizerIcon className="w-5 h-5" />,
      iconColor: 'blue',
      anchors: ['audio_equalizer', 'audio_equalizer_preamp', 'audio_equalizer_bands', 'audio_equalizer_preset'],
      render: () => (
        <Suspense fallback={<div className="min-h-[320px]" />}>
          <EqualizerPage />
        </Suspense>
      ),
    },
    {
      id: 'visualizer',
      title: t('music.visualizer.title'),
      subtitle: t('music.visualizer.subtitle'),
      icon: <MusicSectionIcon className="w-5 h-5" />,
      iconColor: 'blue',
      anchors: ['music_visualizer', 'music_visualizer_settings'],
      render: () => <MusicVisualizerPage />,
      headerAction: () => <MusicResetButton />,
    },
    {
      id: 'lyrics',
      title: t('music.lyrics.title'), subtitle: t('music.lyrics.description'),
      icon: <MusicSectionIcon className="w-5 h-5" />, iconColor: 'pink',
      anchors: ['music_lyrics', 'music_lyrics_settings'], render: () => <MusicLyricsPage />,
      headerAction: () => <MusicResetButton lyrics />,
    },
    {
      id: 'upload',
      title: t('music.upload_title'),
      subtitle: t('music.upload_desc'),
      icon: <UploadIcon className="w-5 h-5" />,
      iconColor: 'orange',
      anchors: ['audio_multi_upload', 'audio_upload_delay_between', 'audio_upload_delay_save'],
      render: () => <AudioUploadPage />,
    },
  ];

  return (
    <SubpageHost subpages={subpages}>
      <div className="space-y-4">
        <SettingsSection
        title={t('music.library_section')}
        description={t('music.library_section_desc')}
        icon={<MusicSectionIcon className="w-5 h-5" />}
        iconColor="pink"
      >
        <NavRow
          subpage="download"
          docsId="audio_download"
          title={t('music.download_title')}
          description={t('music.download_desc')}
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="pink"
          meta={audioDownloadOn ? t('on') : t('off')}
        />
        <SectionDivider />
        <NavRow
          subpage="upload"
          docsId="audio_multi_upload"
          title={t('music.upload_title')}
          description={t('music.upload_desc')}
          icon={<UploadIcon className="w-5 h-5" />}
          iconColor="orange"
          meta={audioUploadOn ? t('on') : t('off')}
        />
        </SettingsSection>

        <SettingsSection
        title={t('player.section')}
        description={t('player.section_desc')}
        icon={<MusicSectionIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <NavRow
          subpage="hotkeys"
          docsId="media_player_hotkeys"
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
        {autoplayOn && (
          <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={t('player.autoplay_permission_title')} variant="tip" className="mx-4 mb-4">
            <p>{t(IS_FIREFOX ? 'player.autoplay_permission_firefox_desc' : 'player.autoplay_permission_desc')}</p>
            <button
              type="button"
              className="mt-2 font-semibold underline underline-offset-2"
              onClick={() => openTab(IS_FIREFOX
                ? 'https://support.mozilla.org/kb/block-autoplay'
                : `${BROWSER === 'opera' ? 'opera' : 'chrome'}://settings/content/siteDetails?site=https%3A%2F%2Fvk.ru`)}
            >
              {t(IS_FIREFOX ? 'player.autoplay_permission_firefox_help' : 'player.autoplay_permission_open')}
            </button>
          </InfoBlock>
        )}
        <SectionDivider />
        <NavRow
          subpage="equalizer"
          docsId="audio_equalizer"
          title={t('player.eq_title')}
          description={t('player.eq_desc')}
          icon={<EqualizerIcon className="w-5 h-5" />}
          iconColor="blue"
          meta={equalizerOn ? t('on') : t('off')}
        />
        </SettingsSection>

        <SettingsSection
        title={t('music.visual_section')}
        description={t('music.visual_section_desc')}
        icon={<MusicSectionIcon className="w-5 h-5" />}
        iconColor="pink"
      >
        <NavRow
          subpage="visualizer"
          title={t('music.visualizer.title')}
          description={t('music.visualizer.nav_desc')}
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="blue"
          meta={visualizerOn ? t('on') : t('off')}
        />
        <SectionDivider />
        <NavRow subpage="lyrics" title={t('music.lyrics.title')} description={t('music.lyrics.description')}
          icon={<MusicSectionIcon className="w-5 h-5" />} iconColor="pink" meta={lyricsOn ? t('on') : t('off')} />
        </SettingsSection>
      </div>
    </SubpageHost>
  );
}
