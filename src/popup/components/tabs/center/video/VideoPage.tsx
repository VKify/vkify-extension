import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import SubpageHost from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import VideoCatalogPage from './VideoCatalogPage.js';
import VideoHotkeysPage from './VideoHotkeysPage.js';
import { DownloadIcon, VideoIcon, GlobeIcon, KeyboardIcon, ImageIcon, SkipBackIcon, PlayIcon, SkipForwardIcon } from '@/popup/components/icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { SegmentedControl } from '@/popup/components/ui/DashboardPrimitives.js';
import { videoFramePosition } from '@/shared/video-card-frame.js';

/**
 * Страница «Видео» хаба «Центр» — скачивание видео с vkvideo.ru
 * (перенесена из вкладки «Медиа»).
 */
export default function VideoPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore(s => s.settings);
  const saveSetting = useVKifyStore(s => s.saveSetting);
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
        <SettingRow id="video_card_frames" title={t('video.frames_title')} description={t('video.frames_desc')}
          icon={<ImageIcon className="w-5 h-5" />} />
        {settings.video_card_frames === true && <div className="space-y-2 px-4 pb-4" data-setting="video_card_frame_position">
          <p className="text-xs text-[var(--text-secondary)]">{t('video.frames_position')}</p>
          <SegmentedControl label={t('video.frames_position')} value={videoFramePosition(settings.video_card_frame_position)}
            options={(['start', 'middle', 'end'] as const).map(value => {
              const Icon = value === 'start' ? SkipBackIcon : value === 'end' ? SkipForwardIcon : PlayIcon;
              return { value, label: t(`video.frames_${value}`), icon: <Icon className="h-4 w-4 shrink-0" /> };
            })}
            onChange={value => { void saveSetting('video_card_frame_position', value); }} />
          <p className="text-xs text-[var(--text-secondary)]">{t('video.frames_reload')}</p>
        </div>}
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
