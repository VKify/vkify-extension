import React from 'react';
import BackButton from './BackButton.js';
import IconTile from './IconTile.js';
import { type IconColor } from './iconColors.js';

/**
 * Презентационная «отдельная страница» функции внутри попапа.
 *
 * Зачем: у функций с большим числом опций (шаблоны сообщений, экспорт диалога
 * и т.п.) настройки не помещаются в один ряд списка, не перегружая страницу
 * раздела. Такая функция получает собственную страницу — пользователь видит
 * только её настройки, без визуального шума соседних разделов.
 *
 * `DetailPage` отвечает ТОЛЬКО за оформление: шапка с кнопкой «назад»,
 * плиткой-иконкой, заголовком и подзаголовком + область контента. Шапка
 * прокручивается вместе с контентом (НЕ липкая) — заголовок всегда наверху
 * страницы, а не висит поверх неё. Навигацией (что открыто, как вернуться)
 * управляет SubpageHost — так страница остаётся переиспользуемой и не знает,
 * кто и откуда её показал.
 */
interface DetailPageProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconColor?: IconColor;
  /** Вернуться на родительскую страницу раздела. */
  onBack: () => void;
  /** Действие в правом крае шапки (например, «Сбросить»). */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export default function DetailPage({
  title,
  subtitle,
  icon,
  iconColor = 'blue',
  onBack,
  headerAction,
  children,
}: DetailPageProps): React.ReactElement {
  // Чисто презентационный компонент: только оформление, без управления
  // прокруткой. Позицией списка при входе/возврате распоряжается SubpageHost.
  return (
    <div className="animate-slide-in-right">
      {/* Шапка наверху страницы, прокручивается вместе с контентом (не липкая) */}
      <header className="mb-3 flex items-center gap-2.5 py-2">
        <BackButton onClick={onBack} />

        {icon && <IconTile icon={icon} color={iconColor} size="sm" />}

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
          )}
        </div>

        {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
      </header>

      <div className="space-y-4">{children}</div>
    </div>
  );
}
