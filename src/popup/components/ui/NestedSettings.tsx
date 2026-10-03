import React from 'react';
import './dashboard-primitives.css';

/** Dependent settings grouped with neutral spacing, background and border. */

interface NestedSettingsProps {
  /** Необязательный заголовок группы (например, «Параметры файла»). */
  label?: string;
  /** Keeps the panel mounted while providing one consistent reveal animation. */
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function NestedSettings({
  label,
  open = true,
  children,
  className = '',
}: NestedSettingsProps): React.ReactElement {
  return (
    <div
      role="group"
      aria-label={label}
      aria-hidden={!open}
      {...(!open ? { inert: '' } : {})}
      className={`nested-settings ${open ? 'is-open' : ''} ${className}`}
    >
      <div className="nested-settings__clip">
        <div className="nested-settings__panel">
          {label && <p className="nested-settings__label">{label}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Строка вложенной настройки с контролом справа (select / input / picker).
 * Слева — название и пояснение, справа — переданный контрол.
 */
interface NestedFieldProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** `start` — выравнивание по верху (для длинных пояснений), иначе по центру. */
  align?: 'center' | 'start';
}

export function NestedField({
  title,
  description,
  children,
  align = 'center',
}: NestedFieldProps): React.ReactElement {
  return (
    <div className={`nested-field flex ${align === 'start' ? 'items-start' : 'items-center'} justify-between gap-3 px-4 py-2.5`}>
      <div className="min-w-0">
        <div className="text-xs font-medium text-[var(--text-primary)]">{title}</div>
        {description && (
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
