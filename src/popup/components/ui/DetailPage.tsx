import React from 'react';
import BackButton from './BackButton.js';
import IconTile from './IconTile.js';

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
  onBack,
  headerAction,
  children,
}: DetailPageProps): React.ReactElement {
  // Чисто презентационный компонент: только оформление, без управления
  // прокруткой. Позицией списка при входе/возврате распоряжается SubpageHost.
  return (
    <div className="detail-page">
      {/* Шапка наверху страницы, прокручивается вместе с контентом (не липкая) */}
      <header className="detail-page__header flex items-center gap-2.5">
        <BackButton onClick={onBack} />

        {icon && <IconTile icon={icon} size="sm" />}

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight break-words">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{subtitle}</p>
          )}
        </div>

        {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
      </header>

      <div className="detail-page__content space-y-4">{children}</div>
    </div>
  );
}
