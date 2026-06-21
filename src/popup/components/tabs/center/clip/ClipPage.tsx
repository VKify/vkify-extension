import React from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import SettingsSection from '../../../ui/SettingsSection.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import { ClipIcon, DownloadIcon } from '../../../icons/Icons.js';

/**
 * Страница «Клипы» хаба «Центр» — скачивание VK Clips
 * (перенесена из вкладки «Медиа»).
 */
export default function ClipPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Клипы"
        description="Скачивание VK Clips"
        icon={<ClipIcon className="w-5 h-5" />}
        iconColor="blue"
      >
        <SettingRow
          id="clip_download"
          title="Скачивание клипов"
          description="Кнопка рядом с лайком"
          icon={<DownloadIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </SettingsSection>

      <InfoBlock variant="tip" icon="🎞️" title="Подсказка">
        Кнопка скачивания появляется в панели управления клипа — качество до 1080p.
      </InfoBlock>
    </div>
  );
}
