import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { MusicSectionIcon, AdIcon } from '@/popup/components/icons/Icons.js';

/**
 * Страница «Музыка» хаба «Скрытие» — элементы раздела аудио.
 */
export default function MusicPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.music')}
        subtitle={t('subtitle.music')}
        icon={<MusicSectionIcon className="w-5 h-5 text-pink-500" />}
        iconBg="bg-pink-500/10"
        elements={[
          {
            id: 'hide_audio_ads',
            title: t('items.hide_audio_ads.title'),
            description: t('items.hide_audio_ads.desc'),
            icon: <AdIcon className="w-5 h-5" />,
            iconColor: 'pink',
          },
        ]}
      />
    </div>
  );
}
