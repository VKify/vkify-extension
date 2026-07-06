import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { VideoIcon, DownloadIcon, SparklesIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Видео» хаба «Центр» — скачивание видео с vkvideo.ru
 * (перенесена из вкладки «Медиа»).
 */
export default function VideoPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('video.section')}
        description={t('video.section_desc')}
        icon={<VideoIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <SettingRow
          id="video_download"
          title={t('video.title')}
          description={t('video.desc')}
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </SettingsSection>
    </div>
  );
}
