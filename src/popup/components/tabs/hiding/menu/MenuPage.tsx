import React from 'react';
import HidingSection from '../HidingSection.js';
import SubpageHost, { type Subpage } from '@/popup/components/ui/SubpageHost.js';
import NavRow from '@/popup/components/ui/NavRow.js';
import ResetButton from '@/popup/components/ui/ResetButton.js';
import MenuItemsSection from './MenuItemsSection.js';
import { MenuSectionIcon, SettingsIcon, CounterIcon } from '@/popup/components/icons/Icons.js';
import { useMenuItems } from '@/popup/hooks/features/useMenuItems.js';

/** Кнопка «Показать все» в шапке подстраницы — прячется, когда скрывать нечего. */
function MenuItemsResetButton(): React.ReactElement | null {
  const { hiddenCount, showAll } = useMenuItems();
  if (hiddenCount === 0) return null;
  return <ResetButton onClick={() => showAll()} aria-label="Показать все пункты" />;
}

const SUBPAGES: Subpage[] = [
  {
    id: 'menu_items',
    title: 'Пункты меню',
    subtitle: 'Что показывать в левом меню',
    icon: <MenuSectionIcon className="w-5 h-5" />,
    iconColor: 'blue',
    anchors: ['hidden_menu_items'],
    render: () => <div data-vkify-anchor="hidden_menu_items"><MenuItemsSection /></div>,
    headerAction: () => <MenuItemsResetButton />,
  },
];

/**
 * Страница «Меню» хаба «Скрытие» — всё, что относится к левому меню VK: выбор
 * отображаемых пунктов (подстраница) и скрытие служебных элементов меню.
 */
export default function MenuPage(): React.ReactElement {
  const { hiddenCount } = useMenuItems();

  return (
    <SubpageHost subpages={SUBPAGES}>
      <div className="space-y-4">
        {/* Отображаемые пункты меню — отдельная подстраница со списком тумблеров */}
        <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
          <NavRow
            subpage="menu_items"
            title="Пункты меню"
            description="Что показывать в левом меню"
            icon={<MenuSectionIcon className="w-5 h-5" />}
            iconColor="blue"
            meta={hiddenCount > 0 ? `${hiddenCount} скрыто` : undefined}
          />
        </section>

        <HidingSection
          title="Меню"
          subtitle="Служебные элементы меню"
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
    </SubpageHost>
  );
}
