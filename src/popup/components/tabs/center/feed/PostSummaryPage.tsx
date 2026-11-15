import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import { SparklesIcon, FileTextIcon } from '@/popup/components/icons/Icons.js';
import PostSummarySettings from './PostSummarySettings.js';
import PostSummaryPromptSettings from './PostSummaryPromptSettings.js';

export default function PostSummaryPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return <div className="space-y-4">
    <SettingsSection>
      <SettingRow id="post_summary" title={t('feed.summary_title')} description={t('feed.summary_desc')} icon={<SparklesIcon className="w-5 h-5" />} />
      <PostSummarySettings />
    </SettingsSection>
    <SettingsSection title={t('feed.prompt_title')} description={t('feed.prompt_desc')} icon={<FileTextIcon className="w-5 h-5" />}>
      <PostSummaryPromptSettings />
    </SettingsSection>
  </div>;
}
