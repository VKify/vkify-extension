import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PaletteIcon,
  LayoutIcon,
  ShieldIcon,
  BanIcon,
  CodeIcon,
  ActivityIcon,
  SettingsIcon,
  MusicIcon,
  ZapIcon,
  LayoutRowsIcon,
  BookmarkIcon,
  WidgetsIcon,
} from '../icons/Icons.js';
import type { TabDef } from '../../constants/tabs.js';
import { useVKifyStore } from '../../store/index.js';

interface TabsProps {
  tabs: TabDef[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  palette: PaletteIcon,
  layout: LayoutIcon,
  shield: ShieldIcon,
  ban: BanIcon,
  code: CodeIcon,
  zap: ZapIcon,
  activity: ActivityIcon,
  settings: SettingsIcon,
  music: MusicIcon,
  'layout-rows': LayoutRowsIcon,
  bookmark: BookmarkIcon,
  widgets: WidgetsIcon,
};

export default function Tabs({ tabs }: TabsProps) {
  const { t } = useTranslation('settings');
  // Активная вкладка и её переключение живут в сторе (ui-слайс) — компонент
  // подписан узко, ре-рендерится только на смену вкладки.
  const activeTab = useVKifyStore((s) => s.activeTab);
  const setActiveTab = useVKifyStore((s) => s.setActiveTab);

  return (
    <nav className="px-5 my-3">
      <div className="popup-tabs bg-[var(--bg-primary)] rounded-2xl p-1.5 border border-[color-mix(in_srgb,var(--border-color)_58%,transparent)]">
        {tabs.map((tab) => {
          const IconComponent = iconMap[tab.icon];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`
                popup-tabs__item text-center
                ${isActive
                  ? 'bg-[var(--primary-solid)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}
              `}
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              <span className="popup-tabs__label">
                {t(`tabs.${tab.id}`, { defaultValue: tab.id })}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
