import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { FeedIcon, FileTextIcon, StoryIcon, InfoIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Лента» хаба «Центр» — поведение постов в новостной ленте.
 */
export default function FeedPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <SettingsSection
        title="Лента"
        description="Поведение постов в ленте"
        icon={<FeedIcon className="w-5 h-5" />}
        iconColor="orange"
      >
        <SettingRow
          id="expand_post_text"
          title="Разворачивать посты"
          description="Текст целиком, без «показать ещё»"
          icon={<FileTextIcon className="w-5 h-5" />}
          iconColor="orange"
        />
        <SectionDivider />
        <SettingRow
          id="story_download"
          title="Скачивание сторис"
          description="Кнопка «Скачать» в сторис"
          icon={<StoryIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </SettingsSection>
    </div>
  );
}
