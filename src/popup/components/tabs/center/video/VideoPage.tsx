import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { VideoIcon, DownloadIcon, SparklesIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Видео» хаба «Центр» — скачивание видео с vkvideo.ru
 * (перенесена из вкладки «Медиа»).
 */
export default function VideoPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Видео"
        description="Скачивание видео с vkvideo.ru"
        icon={<VideoIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <SettingRow
          id="video_download"
          title="Скачивание видео"
          description="Кнопка «Скачать» с выбором качества"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </SettingsSection>
    </div>
  );
}
