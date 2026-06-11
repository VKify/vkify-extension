import React from 'react';
import ElementsSection from '../ElementsSection.js';
import { MenuSectionIcon, SettingsIcon, CounterIcon } from '../../../icons/Icons.js';

/**
 * Страница «Меню» хаба «Элементы» — элементы левого меню VK.
 */
export default function MenuPage(): React.ReactElement {
  return (
    <div className="space-y-4">
      <ElementsSection
        title="Меню"
        subtitle="Элементы левого меню"
        icon={<MenuSectionIcon className="w-5 h-5 text-cyan-500" />}
        iconBg="bg-cyan-500/10"
        elements={[
          {
            id: 'hide_menu_settings',
            title: 'Настройки в меню',
            description: 'Пункт настроек в левом меню',
            icon: <SettingsIcon className="w-5 h-5" />,
            iconColor: 'cyan',
          },
          {
            id: 'hide_menu_counters',
            title: 'Счётчики',
            description: 'Бейджи с числами у пунктов меню',
            icon: <CounterIcon className="w-5 h-5" />,
            iconColor: 'cyan',
          },
        ]}
      />
    </div>
  );
}
