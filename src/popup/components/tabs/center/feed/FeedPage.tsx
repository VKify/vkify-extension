import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import { FileTextIcon, StoryIcon, FeedIcon, EyeIcon, SparklesIcon } from '@/popup/components/icons/Icons.js';
import PostSummaryPage from './PostSummaryPage.js';
import SubpageHost from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';

/**
 * Страница «Лента» хаба «Центр» — поведение постов в новостной ленте.
 */
export default function FeedPage(): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <SubpageHost subpages={[{ id: 'post-summary', title: t('feed.summary_title'), subtitle: t('feed.summary_desc'), icon: <SparklesIcon className="w-5 h-5" />,
      anchors: ['post_summary', 'post_summary_providers', 'post_summary_order', 'post_summary_prompt_ru', 'post_summary_prompt_en'], render: () => <PostSummaryPage /> }]}>
      <SettingsSection>
        <SettingRow id="feed_post_dividers" title={t('feed.dividers_title')} description={t('feed.dividers_desc')}
          icon={<FeedIcon className="w-5 h-5" />} />
        <SettingRow id="post_views" title={t('feed.views_title')} description={t('feed.views_desc')}
          icon={<EyeIcon className="w-5 h-5" />} />
        <NavRow subpage="post-summary" docsId="post_summary" title={t('feed.summary_title')} description={t('feed.summary_desc')}
          icon={<SparklesIcon className="w-5 h-5" />} />
        <SettingRow
          id="expand_post_text"
          title={t('feed.expand_title')}
          description={t('feed.expand_desc')}
          icon={<FileTextIcon className="w-5 h-5" />}
        />
        <SettingRow
          id="story_download"
          title={t('feed.story_title')}
          description={t('feed.story_desc')}
          icon={<StoryIcon className="w-5 h-5" />}
        />
      </SettingsSection>
    </SubpageHost>
  );
}
