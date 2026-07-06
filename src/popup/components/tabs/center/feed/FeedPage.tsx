import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import { FeedIcon, FileTextIcon, StoryIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Лента» хаба «Центр» — поведение постов в новостной ленте.
 */
export default function FeedPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('feed.section')}
        description={t('feed.section_desc')}
        icon={<FeedIcon className="w-5 h-5" />}
        iconColor="orange"
      >
        <SettingRow
          id="expand_post_text"
          title={t('feed.expand_title')}
          description={t('feed.expand_desc')}
          icon={<FileTextIcon className="w-5 h-5" />}
          iconColor="orange"
        />
        <SectionDivider />
        <SettingRow
          id="story_download"
          title={t('feed.story_title')}
          description={t('feed.story_desc')}
          icon={<StoryIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </SettingsSection>
    </div>
  );
}
