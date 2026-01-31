import React from 'react';
import { PaletteIcon, LayoutIcon, ShieldIcon, BanIcon, SettingsIcon, FilterIcon, CodeIcon } from './icons/Icons';

const iconMap = {
  palette: PaletteIcon,
  filter: FilterIcon,
  layout: LayoutIcon,
  shield: ShieldIcon,
  ban: BanIcon,
  code: CodeIcon,
  settings: SettingsIcon,
};

export default function Tabs({ tabs, activeTab, setActiveTab }) {
  return (
    <nav className="px-5 mb-4">
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
              <IconComponent className="w-4 h-4" />
              <span className="text-[9px] font-semibold leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}