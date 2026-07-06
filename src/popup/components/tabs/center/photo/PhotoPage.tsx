import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { PhotoAlbumIcon, DownloadIcon, ImageIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Фото» хаба «Центр» — скачивание фотографий и альбомов
 * (перенесена из вкладки «Медиа»).
 */
export default function PhotoPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('photo.section')}
        description={t('photo.section_desc')}
        icon={<PhotoAlbumIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <SettingRow
          id="photo_download"
          title={t('photo.title')}
          description={t('photo.desc')}
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </SettingsSection>
    </div>
  );
}
