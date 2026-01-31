import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../context/ToastContext';
import { CheckIcon, SunIcon, MoonIcon } from '../icons/Icons';

const themes = [
  { 
    id: 'light', 
    name: 'Светлая',
    icon: SunIcon,
  },
  { 
    id: 'dark', 
    name: 'Тёмная',
    icon: MoonIcon,
  },
  { 
    id: 'auto', 
    name: 'Как в системе',
    icon: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
];

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();

  const handleThemeChange = async (newTheme) => {
    if (newTheme === theme) return;
    
    await setTheme(newTheme);
    const names = { light: 'Светлая тема', dark: 'Тёмная тема', auto: 'Системная тема' };
    showToast(names[newTheme], 'success');
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {themes.map((t) => {
        const IconComponent = t.icon;
        const isActive = theme === t.id;
        
        return (
          <button
            key={t.id}
            onClick={() => handleThemeChange(t.id)}
            className={`
              relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200
              ${isActive 
                ? 'border-primary bg-primary/5' 
                : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]'}
            `}
          >
            {/* Preview */}
            <div className={`
              w-full h-10 rounded-lg overflow-hidden relative border
              ${isActive ? 'border-primary/30' : 'border-[var(--border-color)]'}
              ${t.id === 'light' ? 'bg-white' : ''}
              ${t.id === 'dark' ? 'bg-[#1a1a1a]' : ''}
              ${t.id === 'auto' ? 'bg-gradient-to-r from-white to-[#1a1a1a]' : ''}
            `}>
              <div className={`
                h-2.5 
                ${t.id === 'dark' ? 'bg-[#2a2a2a]' : 'bg-gray-100'} 
                ${t.id === 'auto' ? 'bg-gradient-to-r from-gray-100 to-[#2a2a2a]' : ''}
              `} />
              <div className="p-1.5 space-y-1">
                <div className={`
                  h-1 rounded-full w-2/3
                  ${t.id === 'dark' ? 'bg-[#3a3a3a]' : 'bg-gray-200'} 
                  ${t.id === 'auto' ? 'bg-gradient-to-r from-gray-200 to-[#3a3a3a]' : ''}
                `} />
              </div>
            </div>
            
            {/* Label */}
            <div className="flex items-center gap-1.5">
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-[var(--text-secondary)]'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-[var(--text-primary)]'}`}>
                {t.name}
              </span>
            </div>

            {/* Check indicator */}
            {isActive && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                <CheckIcon className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}