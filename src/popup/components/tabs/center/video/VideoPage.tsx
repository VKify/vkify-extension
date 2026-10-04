import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import SubpageHost from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import VideoCatalogPage from './VideoCatalogPage.js';
import VideoHotkeysPage from './VideoHotkeysPage.js';
import { DownloadIcon, VideoIcon, GlobeIcon, KeyboardIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Видео» хаба «Центр» — скачивание видео с vkvideo.ru
 * (перенесена из вкладки «Медиа»).
 */
export default function VideoPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <SubpageHost subpages={[
      { id: 'video-catalog', title: t('video_catalog.title'), subtitle: t('video_catalog.description'), icon: <VideoIcon className="w-5 h-5" />, anchors: ['video-catalog'], render: () => <VideoCatalogPage /> },
      { id: 'video-hotkeys', title: t('video_hotkeys.title'), subtitle: t('video_hotkeys.description'), icon: <KeyboardIcon className="w-5 h-5" />, anchors: ['video_player_hotkeys'], render: () => <VideoHotkeysPage /> },
    ]}>
    <div className="space-y-4">
      <SettingsSection title={t('tools.api_title')} description={t('video_catalog.api_description')} icon={<GlobeIcon className="w-5 h-5" />} className="ct-api-section">
        <NavRow subpage="video-catalog" title={t('video_catalog.title')} description={t('video_catalog.description')} icon={<VideoIcon className="w-5 h-5" />} />
      </SettingsSection>
      <SettingsSection title={t('video_catalog.page_tools')}>
        <NavRow subpage="video-hotkeys" title={t('video_hotkeys.title')} description={t('video_hotkeys.description')}
          icon={<KeyboardIcon className="w-5 h-5" />} />
        <SettingRow
          id="video_download"
          title={t('video.title')}
          description={t('video.desc')}
          icon={<DownloadIcon className="w-5 h-5" />}
        />
      </SettingsSection>
    </div>
    </SubpageHost>
  );
}
