import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { ClipIcon, DownloadIcon, SparklesIcon } from '@/popup/components/icons/Icons.js';

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
    </div>
  );
}
