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
};

export default function Tabs({ tabs }: TabsProps) {
  const { t } = useTranslation('settings');
  // Активная вкладка и её переключение живут в сторе (ui-слайс) — компонент
  // подписан узко, ре-рендерится только на смену вкладки.
  const activeTab = useVKifyStore((s) => s.activeTab);
  const setActiveTab = useVKifyStore((s) => s.setActiveTab);

  return (
    <nav className="px-5 mt-4 mb-4">
      <div className="flex bg-[var(--bg-primary)] rounded-2xl p-1.5 shadow-card">
        {tabs.map((tab) => {
          const IconComponent = iconMap[tab.icon];
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center gap-1 py-2 px-0.5 rounded-xl transition-all duration-200 text-center
                ${isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}
              `}
            >
              {IconComponent && <IconComponent className="w-4 h-4" />}
              <span className="text-[9px] font-semibold leading-tight">
                {t(`tabs.${tab.id}`, { defaultValue: tab.id })}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}