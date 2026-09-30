import React from 'react';
import './dashboard-primitives.css';

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
interface NestedSettingsProps {
  /** Цвет направляющей — должен совпадать с `iconColor` родительского тумблера. */
  accent?: NestedAccent;
  /** Необязательный заголовок группы (например, «Параметры файла»). */
  label?: string;
  /** Keeps the panel mounted while providing one consistent reveal animation. */
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function NestedSettings({
  accent: _accent = 'blue',
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
