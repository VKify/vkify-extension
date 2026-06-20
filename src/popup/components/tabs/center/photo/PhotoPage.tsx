import React from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import { PhotoAlbumIcon, DownloadIcon } from '../../../icons/Icons.js';

/**
 * Страница «Фото» хаба «Центр» — скачивание фотографий и альбомов
 * (перенесена из вкладки «Медиа»).
 */
export default function PhotoPage(): React.ReactElement {
  return (
    <div className="space-y-4">

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <PhotoAlbumIcon className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Фото</h3>
        </div>

        <SettingRow
          id="photo_download"
          title="Скачивание фото и альбомов"
          description="«Скачать» при просмотре фото и «Скачать альбом» (ZIP-архив) в заголовке альбома"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </section>

      <InfoBlock variant="tip" icon="🖼️" title="Подсказка">
        Отдельное фото скачивается в оригинале, а целый альбом — одним ZIP-архивом в подпапку.
      </InfoBlock>

    </div>
  );
}
