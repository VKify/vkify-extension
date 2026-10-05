import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import SubpageHost from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import PhotoCatalogPage from './PhotoCatalogPage.js';

import { DownloadIcon, PhotoAlbumIcon, GlobeIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Фото» хаба «Центр» — скачивание фотографий и альбомов
 * (перенесена из вкладки «Медиа»).
 */
export default function PhotoPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <SubpageHost subpages={[{ id: 'photo-catalog', title: t('photo_catalog.title'), subtitle: t('photo_catalog.description'), icon: <PhotoAlbumIcon className="w-5 h-5" />, anchors: ['photo-catalog'], render: () => <PhotoCatalogPage /> }]}>
    <div className="space-y-4">
      <SettingsSection title={t('tools.api_title')} description={t('photo_catalog.api_description')} icon={<GlobeIcon className="w-5 h-5" />} className="ct-api-section">
        <NavRow subpage="photo-catalog" title={t('photo_catalog.title')} description={t('photo_catalog.description')} icon={<PhotoAlbumIcon className="w-5 h-5" />} />
      </SettingsSection>
      <SettingsSection>
        <SettingRow
          id="photo_download"
          title={t('photo.title')}
          description={t('photo.desc')}
          icon={<DownloadIcon className="w-5 h-5" />}
        />
      </SettingsSection>
    </div>
    </SubpageHost>
  );
}
