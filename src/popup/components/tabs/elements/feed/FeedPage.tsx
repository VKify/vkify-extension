import React from 'react';
import ElementsSection from '../ElementsSection.js';
import { ImageIcon, LayoutRowsIcon } from '../../../icons/Icons.js';

/**
 * Страница «Лента» хаба «Элементы» — всё, что скрывается в новостной ленте.
 */
export default function FeedPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <ElementsSection
        title="Лента"
        subtitle="Элементы новостной ленты"
        icon={<LayoutRowsIcon className="w-5 h-5 text-orange-500" />}
        iconBg="bg-orange-500/10"
        elements={[
          {
            id: 'hide_stories',
            title: 'Истории',
            description: 'Блок историй в ленте',
            icon: <ImageIcon className="w-5 h-5" />,
            iconColor: 'orange',
          },
        ]}
      />
    </div>
  );
}
