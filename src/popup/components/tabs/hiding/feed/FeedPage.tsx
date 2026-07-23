import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { ImageIcon, FeedIcon, EditIcon, CommentIcon, FilterIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Лента» хаба «Скрытие» — всё, что скрывается в новостной ленте.
 */
export default function FeedPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.feed')}
        subtitle={t('subtitle.feed')}
        icon={<FeedIcon className="w-5 h-5 text-orange-500" />}
        iconBg="bg-orange-500/10"
        elements={[
          {
            id: 'hide_stories',
            title: t('items.hide_stories.title'),
            description: t('items.hide_stories.desc'),
            icon: <ImageIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
          {
            id: 'hide_post_box',
            title: t('items.hide_post_box.title'),
            description: t('items.hide_post_box.desc'),
            icon: <EditIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
          {
            id: 'hide_post_comments',
            title: t('items.hide_post_comments.title'),
            description: t('items.hide_post_comments.desc'),
            icon: <CommentIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
          {
            id: 'hide_feed_right_column',
            title: t('items.hide_feed_right_column.title'),
            description: t('items.hide_feed_right_column.desc'),
            icon: <FilterIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
        ]}
      />
    </div>
  );
}
