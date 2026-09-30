import React from 'react';
import IconTile from './IconTile.js';
import { type IconColor } from './iconColors.js';
import DocsLink from './DocsLink.js';
import './dashboard-primitives.css';

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
  /** Optional feature id for a contextual documentation shortcut. */
  docsId?: string;
  children: React.ReactNode;
  className?: string;
}
export default function SettingsSection({
  title,
  description,
  icon,
  iconColor = 'blue',
  action,
  docsId,
  children,
  className = '',
}: SettingsSectionProps): React.ReactElement {
  return (
    <section className={`dashboard-panel overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="dashboard-panel__header">
          <div className="flex items-center gap-3 min-w-0">
            {icon && <IconTile icon={icon} color={iconColor} />}
            {title && (
              <div className="dashboard-panel__copy">
                <h3>{title}</h3>
                {description && (
                  <p>{description}</p>
                )}
              </div>
            )}
          </div>
          {(action || docsId) && (
            <div className="flex flex-shrink-0 items-center gap-1">
              {docsId && <DocsLink featureId={docsId} />}
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
