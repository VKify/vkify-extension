import React from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import { ClipIcon, DownloadIcon } from '../../../icons/Icons.js';

/**
 * Страница «Клипы» хаба «Центр» — скачивание VK Clips
 * (перенесена из вкладки «Медиа»).
 */
export default function ClipPage(): React.ReactElement {
  return (
    <div className="space-y-4">

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <ClipIcon className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Клипы</h3>
        </div>

        <SettingRow
          id="clip_download"
          title="Кнопка скачивания клипов"
          description="Кнопка в правой панели управления клипа — рядом с лайком (vk.com и vkvideo.ru)"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </section>

      <InfoBlock variant="tip" icon="🎞️" title="Подсказка">
        Кнопка скачивания появляется в панели управления клипа — выбирайте качество до 1080p.
      </InfoBlock>

    </div>
  );
}
