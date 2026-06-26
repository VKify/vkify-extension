import React from 'react';
import Toggle from './Toggle.js';
import { useVKifyStore } from '../../store/index.js';
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
  /**
   * Controlled-режим. Если задан `onToggle`, ряд НЕ читает/пишет настройку сам:
   * состояние берётся из `checked`, а изменение делегируется `onToggle` (тосты —
   * на стороне вызывающего). Нужно, когда источник истины не chrome.storage,
   * а, например, сервер VK (см. онлайн-статус в PrivacyTab).
   */
  checked?: boolean;
  onToggle?: (value: boolean) => void;
}

export default function SettingRow({
  id,
  title,
  description,
  icon,
  iconColor = 'blue',
  badge,
  disabled = false,
  checked: checkedProp,
  onToggle,
}: SettingRowProps) {
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { showToast } = useToast();

  const controlled = onToggle !== undefined;
  const checked = controlled ? checkedProp === true : settings[id] === true;

  const handleChange = async (value: boolean): Promise<void> => {
    if (disabled) return;
    if (controlled) {
      onToggle(value);
      return;
    }
    const success = await saveSetting(id, value);
    if (success) {
      showToast(`${title}: ${value ? 'включено' : 'выключено'}`, 'success');
    }
  };

  const colors: Record<IconColor, { bg: string; text: string; active: string; ring: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500', active: 'bg-blue-500', ring: 'ring-blue-500/20' },
    green: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', active: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
    red: { bg: 'bg-red-500/10', text: 'text-red-500', active: 'bg-red-500', ring: 'ring-red-500/20' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500', active: 'bg-purple-500', ring: 'ring-purple-500/20' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-500', active: 'bg-orange-500', ring: 'ring-orange-500/20' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', active: 'bg-cyan-500', ring: 'ring-cyan-500/20' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-500', active: 'bg-pink-500', ring: 'ring-pink-500/20' },
  };

  const currentColor = colors[iconColor];
  const isEmoji = typeof icon === 'string';

  return (
    <label
      data-vkify-anchor={id}
      className={`
        group flex items-center justify-between px-4 py-3 cursor-pointer
        transition-all duration-150
        hover:bg-[var(--bg-secondary)]/50
        active:bg-[var(--bg-secondary)]/80
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon != null && (
          <div
            className={`
              relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              transition-all duration-200 ring-1 ring-inset
              ${currentColor.bg} ${currentColor.text} ${currentColor.ring}
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
        )}

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

      <div className="flex-shrink-0 ml-3">
        <Toggle checked={checked} onChange={handleChange} disabled={disabled} />
      </div>
    </label>
  );
}