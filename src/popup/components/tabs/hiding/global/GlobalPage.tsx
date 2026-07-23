import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import {
  GlobeIcon,
  SparklesIcon,
  MessageCircleIcon,
  ArrowUpIcon,
  InfoIcon,
} from '@/popup/components/icons/Icons.js';

/**
 * Страница «Глобально» хаба «Скрытие» — элементы, которые видны по всему
 * сайту, а не на конкретной странице.
 */
export default function GlobalPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return (
    <div className="space-y-4">
      <HidingSection
        title={t('rail.global')}
        subtitle={t('subtitle.global')}
        icon={<GlobeIcon className="w-5 h-5 text-purple-500" />}
        iconBg="bg-purple-500/10"
        elements={[
          {
            id: 'hide_recommendations',
            title: t('items.hide_recommendations.title'),
            description: t('items.hide_recommendations.desc'),
            icon: <SparklesIcon className="w-5 h-5" />,
            iconColor: 'purple',
          },
          {
            id: 'hide_mini_chat',
            title: t('items.hide_mini_chat.title'),
            description: t('items.hide_mini_chat.desc'),
            icon: <MessageCircleIcon className="w-5 h-5" />,
            iconColor: 'cyan',
          },
          {
            id: 'hide_scroll_top',
            title: t('items.hide_scroll_top.title'),
            description: t('items.hide_scroll_top.desc'),
            icon: <ArrowUpIcon className="w-5 h-5" />,
            iconColor: 'green',
          },
        ]}
      />
    </div>
  );
}
