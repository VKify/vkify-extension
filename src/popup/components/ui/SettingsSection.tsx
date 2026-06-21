import React from 'react';
import IconTile from './IconTile.js';
import { type IconColor } from './iconColors.js';

/**
 * Карточка-секция со списком настроек. Группирует связанные пункты под общим
 * заголовком, визуально отделяя их от соседних групп (отдельная карточка с
 * фоном и тенью) — пункты разных смыслов не сливаются в одну простыню.
 *
 * Это базовый кирпич отдельных страниц функций (DetailPage): вместо одной
 * длинной карточки с вложенными `NestedSettings` страница собирается из
 * нескольких `SettingsSection` — по секции на смысловую группу.
 */
interface SettingsSectionProps {
  /** Заголовок группы. Если не задан — секция без шапки (просто карточка). */
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  iconColor?: IconColor;
  /** Действие в правом углу шапки — например, кнопка «Добавить». */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function SettingsSection({
  title,
  description,
  icon,
  iconColor = 'blue',
  action,
  children,
  className = '',
}: SettingsSectionProps): React.ReactElement {
  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <IconTile icon={icon} color={iconColor} />}
            {title && (
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[var(--text-primary)] leading-tight">{title}</h3>
                {description && (
                  <p className="text-xs text-[var(--text-secondary)] leading-snug">{description}</p>
                )}
              </div>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Тонкий разделитель между рядами внутри одной секции. */
export function SectionDivider(): React.ReactElement {
  return <div className="mx-3 border-t border-[var(--border-color)]" />;
}
