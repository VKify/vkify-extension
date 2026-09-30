import React from 'react';
import { useTranslation } from 'react-i18next';
import Toggle from './Toggle.js';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';
import { useToast } from '../../context/ToastContext.js';
import DocsLink from './DocsLink.js';
import IconTile from './IconTile.js';

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
  iconColor: _iconColor = 'blue',
  badge,
  disabled = false,
  checked: checkedProp,
  onToggle,
}: SettingRowProps) {
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { showToast } = useToast();
  const { t } = useTranslation('common');

  // Узкая подписка на свой ключ: тоггл одного ряда не ре-рендерит остальные
  // (на странице их могут быть десятки). В controlled-режиме значение не
  // используется, но хук вызывается безусловно — правило хуков.
  const stored = useSetting(id);
  const controlled = onToggle !== undefined;
  const checked = controlled ? checkedProp === true : stored === true;

  const handleChange = async (value: boolean): Promise<void> => {
    if (disabled) return;
    if (controlled) {
      onToggle(value);
      return;
    }
    const success = await saveSetting(id, value);
    if (success) {
      showToast(t(value ? 'toast.setting_enabled' : 'toast.setting_disabled', { title }), 'success');
    }
  };

  return (
    <label
      data-vkify-anchor={id}
      className={`
        group flex items-center justify-between px-4 py-3 cursor-pointer
        transition-all duration-150
        hover:bg-[var(--bg-secondary)]/50
        active:bg-[var(--bg-secondary)]/80
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon != null && (
          <div className="relative flex-shrink-0">
            <IconTile icon={icon} />

            <div
              className={`
                absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full
                border-2 border-[var(--bg-primary)]
                transition-all duration-300
                ${checked
                  ? 'bg-primary scale-100 opacity-100'
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
            <span
              className="setting-row__description text-xs text-[var(--text-secondary)] mt-0.5 leading-snug"
              title={typeof description === 'string' ? description : undefined}
            >
              {description}
            </span>
          )}
        </div>
      </div>

      <div className="ml-3 flex flex-shrink-0 items-center gap-2">
        <DocsLink featureId={id} />
        <Toggle checked={checked} onChange={handleChange} disabled={disabled} />
      </div>
    </label>
  );
}
