import React from 'react';
import ElementsSection from '../ElementsSection.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import {
  GlobeIcon,
  SparklesIcon,
  MessageCircleIcon,
  ArrowUpIcon,
  LockIcon,
} from '../../../icons/Icons.js';

/**
 * Страница «Глобально» хаба «Элементы» — элементы, которые видны по всему
 * сайту, а не на конкретной странице.
 */
export default function GlobalPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <ElementsSection
        title="Глобально"
        subtitle="Элементы на всех страницах VK"
        icon={<GlobeIcon className="w-5 h-5 text-purple-500" />}
        iconBg="bg-purple-500/10"
        elements={[
          {
            id: 'hide_recommendations',
            title: 'Рекомендации',
            description: 'Рекомендуемый контент',
            icon: <SparklesIcon className="w-5 h-5" />,
            iconColor: 'purple',
          },
          {
            id: 'hide_mini_chat',
            title: 'Мини-чат',
            description: 'Всплывающий чат в углу',
            icon: <MessageCircleIcon className="w-5 h-5" />,
            iconColor: 'cyan',
          },
          {
            id: 'hide_scroll_top',
            title: 'Кнопка «Наверх»',
            description: 'Кнопка прокрутки вверх',
            icon: <ArrowUpIcon className="w-5 h-5" />,
            iconColor: 'green',
          },
          {
            id: 'hide_auth_popup',
            title: 'Убрать окно авторизации',
            description: 'Скрывает всплывающие окна входа и баннеры',
            icon: <LockIcon className="w-5 h-5" />,
            iconColor: 'red',
          },
        ]}
      />

      <InfoBlock variant="tip" icon="💡" title="Подсказка">
        Скрытие элементов помогает сосредоточиться на важном контенте
      </InfoBlock>
    </div>
  );
}
