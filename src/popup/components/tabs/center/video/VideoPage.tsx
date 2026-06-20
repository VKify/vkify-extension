import React from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import { VideoIcon, DownloadIcon } from '../../../icons/Icons.js';

/**
 * Страница «Видео» хаба «Центр» — скачивание видео с vkvideo.ru
 * (перенесена из вкладки «Медиа»).
 */
export default function VideoPage(): React.ReactElement {
  return (
    <div className="space-y-4">

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <VideoIcon className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Видео</h3>
        </div>

        <SettingRow
          id="video_download"
          title="Кнопка скачивания на vkvideo.ru"
          description="Добавляет кнопку «Скачать» на страницу видео с выбором качества"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </section>

      <InfoBlock variant="tip" icon="🎬" title="Подсказка">
        Кнопка «Скачать» появляется на странице видео на vkvideo.ru — можно выбрать качество до 1080p.
      </InfoBlock>

    </div>
  );
}
