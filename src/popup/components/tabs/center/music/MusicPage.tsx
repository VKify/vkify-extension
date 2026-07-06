import React from 'react';
import { useTranslation } from 'react-i18next';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import AudioDownloadPage from './AudioDownloadPage.js';
import AudioUploadPage from './AudioUploadPage.js';
import { useFeatureEnabled } from '@/popup/store/selectors.js';
import { MusicSectionIcon, UploadIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Музыка» хаба «Центр». Две функции, у каждой много опций, поэтому
 * каждая открывается на собственной странице (SubpageHost → DetailPage):
 *  • «Сохранение в MP3» — теги, текст, качество, имя файла;
 *  • «Загрузка нескольких треков» — задержки против Flood control.
 */
export default function MusicPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const audioDownloadOn = useFeatureEnabled('audio_download');
  const audioUploadOn = useFeatureEnabled('audio_multi_upload');

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
      <SettingsSection
        title={t('music.section')}
        description={t('music.section_desc')}
        icon={<MusicSectionIcon className="w-5 h-5" />}
        iconColor="pink"
      >
        <NavRow
          subpage="download"
          title={t('music.download_title')}
          description={t('music.download_desc')}
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="pink"
          meta={audioDownloadOn ? t('on') : t('off')}
        />
        <SectionDivider />
        <NavRow
          subpage="upload"
          title={t('music.upload_title')}
          description={t('music.upload_desc')}
          icon={<UploadIcon className="w-5 h-5" />}
          iconColor="orange"
          meta={audioUploadOn ? t('on') : t('off')}
        />
      </SettingsSection>
    </SubpageHost>
  );
}
