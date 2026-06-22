import React from 'react';
import ElementsSection from '../ElementsSection.js';
import { ImageIcon, FeedIcon, EditIcon, CommentIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Лента» хаба «Элементы» — всё, что скрывается в новостной ленте.
 */
export default function FeedPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <ElementsSection
        title="Лента"
        subtitle="Элементы новостной ленты"
        icon={<FeedIcon className="w-5 h-5 text-orange-500" />}
        iconBg="bg-orange-500/10"
        elements={[
          {
            id: 'hide_stories',
            title: 'Истории',
            description: 'Блок историй в ленте',
            icon: <ImageIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
          {
            id: 'hide_post_box',
            title: 'Добавление поста',
            description: 'Блок написания нового поста',
            icon: <EditIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
          {
            id: 'hide_post_comments',
            title: 'Комментарии',
            description: 'Комментарии под постами',
            icon: <CommentIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
        ]}
      />
    </div>
  );
}
