import React from 'react';

/**
 * Обёртка для дочерних настроек, которые появляются под включённым тумблером.
 *
 * Зачем: раньше вложенные пункты рендерились в полную ширину тем же стилем,
 * что и настройки верхнего уровня, — иерархия не читалась, и было непонятно,
 * какой пункт к какому тумблеру относится. `NestedSettings` визуально
 * «привязывает» дочерние пункты к родителю:
 *  • утопленный фон — группа «вдавлена» относительно пунктов верхнего уровня;
 *  • цветная направляющая слева (в цвет иконки родительского тумблера);
 *  • отступ слева — содержимое сдвинуто вправо, читается как «вложено»;
 *  • плавное раскрытие при включении тумблера (slide-down).
 */

export type NestedAccent =
  | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

// Направляющая — вертикальный градиент (ярче у верха, ближе к родителю),
// и точка-«якорь» у заголовка в тот же цвет. Совпадает с палитрой иконок
// SettingRow, поэтому связь «тумблер → его настройки» читается по цвету.
const ACCENT: Record<NestedAccent, { rail: string; dot: string }> = {
  blue:   { rail: 'from-blue-500 to-blue-500/30',       dot: 'bg-blue-500' },
  green:  { rail: 'from-emerald-500 to-emerald-500/30', dot: 'bg-emerald-500' },
  red:    { rail: 'from-red-500 to-red-500/30',         dot: 'bg-red-500' },
  purple: { rail: 'from-purple-500 to-purple-500/30',   dot: 'bg-purple-500' },
  orange: { rail: 'from-orange-500 to-orange-500/30',   dot: 'bg-orange-500' },
  cyan:   { rail: 'from-cyan-500 to-cyan-500/30',       dot: 'bg-cyan-500' },
  pink:   { rail: 'from-pink-500 to-pink-500/30',       dot: 'bg-pink-500' },
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
  const a = ACCENT[accent];

  return (
    <div
      role="group"
      aria-label={label}
      className={`relative border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/30 animate-slide-down ${className}`}
    >
      {/* Направляющая в цвет родителя — связывает дочерние пункты с тумблером выше */}
      <div className={`absolute left-0 inset-y-1.5 w-[3px] rounded-full bg-gradient-to-b ${a.rail}`} />

      {/* Отступ слева сдвигает содержимое вправо — читается как «вложено» */}
      <div className="pl-3">
        {label && (
          <p className="flex items-center gap-1.5 px-4 pt-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
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
