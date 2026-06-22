import React from 'react';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import AudioDownloadPage from './AudioDownloadPage.js';
import AudioUploadPage from './AudioUploadPage.js';
import { useSettings } from '@/popup/context/SettingsContext.js';
import { MusicSectionIcon, UploadIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Музыка» хаба «Центр». Две функции, у каждой много опций, поэтому
 * каждая открывается на собственной странице (SubpageHost → DetailPage):
 *  • «Сохранение в MP3» — теги, текст, качество, имя файла;
 *  • «Загрузка нескольких треков» — задержки против Flood control.
 */
const SUBPAGES: Subpage[] = [
  {
    id: 'download',
    title: 'Сохранение в MP3',
    subtitle: 'Скачивание треков и альбомов',
    icon: <MusicSectionIcon className="w-5 h-5" />,
    iconColor: 'pink',
    anchors: ['audio_download', 'audio_download_id3', 'audio_download_lyrics', 'audio_download_bitrate', 'audio_download_filename'],
    render: () => <AudioDownloadPage />,
  },
  {
    id: 'upload',
    title: 'Загрузка нескольких треков',
    subtitle: 'Несколько файлов сразу',
    icon: <UploadIcon className="w-5 h-5" />,
    iconColor: 'orange',
    anchors: ['audio_multi_upload', 'audio_upload_delay_between', 'audio_upload_delay_save'],
    render: () => <AudioUploadPage />,
  },
];

export default function MusicPage(): React.ReactElement {
  const { settings } = useSettings();

  return (
    <SubpageHost subpages={SUBPAGES}>
      <SettingsSection
        title="Музыка"
        description="Скачивание и загрузка треков"
        icon={<MusicSectionIcon className="w-5 h-5" />}
        iconColor="pink"
      >
        <NavRow
          subpage="download"
          title="Сохранение в MP3"
          description="Трек или альбом локально"
          icon={<MusicSectionIcon className="w-5 h-5" />}
          iconColor="pink"
          meta={settings['audio_download'] === true ? 'Вкл' : 'Выкл'}
        />
        <SectionDivider />
        <NavRow
          subpage="upload"
          title="Загрузка нескольких треков"
          description="Несколько файлов сразу"
          icon={<UploadIcon className="w-5 h-5" />}
          iconColor="orange"
          meta={settings['audio_multi_upload'] === true ? 'Вкл' : 'Выкл'}
        />
      </SettingsSection>
    </SubpageHost>
  );
}
