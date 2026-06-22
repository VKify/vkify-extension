import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { PhotoAlbumIcon, DownloadIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Фото» хаба «Центр» — скачивание фотографий и альбомов
 * (перенесена из вкладки «Медиа»).
 */
export default function PhotoPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Фото"
        description="Скачивание фото и альбомов"
        icon={<PhotoAlbumIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <SettingRow
          id="photo_download"
          title="Скачивание фото"
          description="Фото — в оригинале, альбом — ZIP-архивом"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </SettingsSection>

      <InfoBlock variant="tip" icon="🖼️" title="Подсказка">
        Отдельное фото скачивается в оригинале, а целый альбом — одним ZIP-архивом в подпапку.
      </InfoBlock>
    </div>
  );
}
