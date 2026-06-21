import React from 'react';

/**
 * Обёртка для дочерних настроек, которые появляются под включённым тумблером.
 *
 * Зачем: раньше вложенные пункты рендерились в полную ширину тем же стилем,
 * что и настройки верхнего уровня, — иерархия не читалась, и было непонятно,
 * какой пункт к какому тумблеру относится. `NestedSettings` визуально
 * «привязывает» дочерние пункты к родителю: утопленный фон, цветная
 * направляющая слева (в цвет иконки родительского тумблера) и отступ.
 */

export type NestedAccent =
  | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

const RAIL: Record<NestedAccent, string> = {
  blue:   'bg-blue-500',
  green:  'bg-emerald-500',
  red:    'bg-red-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  cyan:   'bg-cyan-500',
  pink:   'bg-pink-500',
};

interface NestedSettingsProps {
  /** Цвет направляющей — должен совпадать с `iconColor` родительского тумблера. */
  accent?: NestedAccent;
  /** Необязательный заголовок группы (например, «Параметры файла»). */
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export default function NestedSettings({
  accent = 'blue',
  label,
  children,
  className = '',
}: NestedSettingsProps): React.ReactElement {
  return (
    <div className={`relative border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/30 ${className}`}>
      {/* Направляющая в цвет родителя — связывает дочерние пункты с тумблером выше */}
      <div className={`absolute left-0 inset-y-2 w-[3px] rounded-r-full opacity-60 ${RAIL[accent]}`} />

      {/* Отступ слева сдвигает содержимое вправо — читается как «вложено» */}
      <div className="pl-3">
        {label && (
          <p className="px-4 pt-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {label}
          </p>
        )}
        {children}
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
    <div className={`flex ${align === 'start' ? 'items-start' : 'items-center'} justify-between gap-3 px-4 py-2.5`}>
      <div className="min-w-0">
        <div className="text-xs font-medium text-[var(--text-primary)]">{title}</div>
        {description && (
          <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}
