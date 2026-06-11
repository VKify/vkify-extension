import React from 'react';
import ElementsSection from '../ElementsSection.js';
import { MusicSectionIcon, AdIcon } from '../../../icons/Icons.js';

/**
 * Страница «Музыка» хаба «Элементы» — элементы раздела аудио.
 */
export default function MusicPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <ElementsSection
        title="Музыка"
        subtitle="Элементы раздела аудио"
        icon={<MusicSectionIcon className="w-5 h-5 text-pink-500" />}
        iconBg="bg-pink-500/10"
        elements={[
          {
            id: 'hide_audio_ads',
            title: 'Реклама в аудио',
            description: 'Рекламные блоки и баннеры подписки',
            icon: <AdIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
        ]}
      />
    </div>
  );
}
