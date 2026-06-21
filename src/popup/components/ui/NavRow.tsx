import React from 'react';
import { ChevronRightIcon } from '../icons/Icons.js';
import IconTile from './IconTile.js';
import { type IconColor } from './iconColors.js';
import { useSubpageNav } from './SubpageHost.js';

/**
 * Ряд-переход на отдельную подстраницу функции. Визуально — близнец
 * `SettingRow`, но вместо тумблера справа стоит шеврон: пользователю сразу
 * понятно, что это «вход внутрь», а не переключатель.
 *
 * Точка входа для функций с большим числом опций: ряд краток (иконка, название,
 * пояснение, опциональная сводка `meta`), а все настройки раскрываются на
 * собственной странице (см. `SubpageHost` / `DetailPage`).
 */
interface NavRowProps {
  /** id подстраницы в родительском `SubpageHost`, которую открывает ряд. */
  subpage: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: IconColor;
  /** Короткая сводка состояния справа от шеврона — «12 шт.», «Вкл» и т.п. */
  meta?: React.ReactNode;
  badge?: string;
}

export default function NavRow({
  subpage,
  title,
  description,
  icon,
  iconColor = 'blue',
  meta,
  badge,
}: NavRowProps): React.ReactElement {
  const { open } = useSubpageNav();

  return (
    <button
      type="button"
      onClick={() => open(subpage)}
      className="group w-full flex items-center justify-between p-4 text-left transition-all duration-150 hover:bg-[var(--bg-secondary)]/50 active:bg-[var(--bg-secondary)]/80"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && <IconTile icon={icon} color={iconColor} />}

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
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

      <div className="flex items-center gap-1.5 flex-shrink-0 ml-3 text-[var(--text-tertiary)]">
        {meta && <span className="text-xs font-medium">{meta}</span>}
        <ChevronRightIcon className="w-5 h-5 transition-transform duration-150 group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
