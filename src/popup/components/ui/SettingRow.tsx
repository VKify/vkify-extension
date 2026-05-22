import React from 'react';
import Toggle from './Toggle.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

interface SettingRowProps {
  id: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: IconColor;
  badge?: string;
  disabled?: boolean;
}

export default function SettingRow({
  id,
  title,
  description,
  icon,
  iconColor = 'blue',
  badge,
  disabled = false,
}: SettingRowProps) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();

  const checked = settings[id] === true;

  const handleChange = async (value: boolean): Promise<void> => {
    if (disabled) return;
    const success = await saveSetting(id, value);
    if (success) {
      showToast(`${title}: ${value ? 'включено' : 'выключено'}`, 'success');
    }
  };

  const colors: Record<IconColor, { bg: string; text: string; active: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', active: 'bg-blue-500' },
    green: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', active: 'bg-emerald-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-500', active: 'bg-red-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', active: 'bg-purple-500' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-500', active: 'bg-orange-500' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', active: 'bg-cyan-500' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-500', active: 'bg-pink-500' },
  };

  const currentColor = colors[iconColor];
  const isEmoji = typeof icon === 'string';

  return (
    <label
      className={`
        group flex items-center justify-between p-4 cursor-pointer
        transition-all duration-150
        hover:bg-[var(--bg-secondary)]/50
        active:bg-[var(--bg-secondary)]/80
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
            relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            transition-all duration-200
            ${currentColor.bg} ${currentColor.text}
            ${checked ? 'shadow-lg shadow-current/10' : ''}
          `}
        >
          {isEmoji ? (
            <span className="text-xl">{icon}</span>
          ) : React.isValidElement(icon) ? (
            icon
          ) : null}

          <div
            className={`
              absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
              border-2 border-[var(--bg-primary)]
              transition-all duration-300
              ${checked
                ? `${currentColor.active} scale-100 opacity-100`
                : 'scale-0 opacity-0'}
            `}
          />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {title}
            </span>
            {badge && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary rounded">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <span className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
              {description}
            </span>
          )}
        </div>
      </div>

      <Toggle checked={checked} onChange={handleChange} disabled={disabled} />
    </label>
  );
}