import React from 'react';
import { ChevronLeftIcon } from '../icons/Icons.js';
import { ICON_COLORS, type IconColor } from './iconColors.js';

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
  children: React.ReactNode;
}

export default function DetailPage({
  title,
  subtitle,
  icon,
  iconColor = 'blue',
  onBack,
  children,
}: DetailPageProps): React.ReactElement {
  const c = ICON_COLORS[iconColor];

  return (
    <div className="animate-slide-in-right">
      {/* Шапка наверху страницы, прокручивается вместе с контентом (не липкая) */}
      <header className="mb-3 flex items-center gap-2.5 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="flex items-center gap-0.5 pl-1 pr-2 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors flex-shrink-0"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          <span className="text-xs font-medium">Назад</span>
        </button>

        {icon && (
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset ${c.bg} ${c.text} ${c.ring}`}
          >
            {typeof icon === 'string' ? <span className="text-lg">{icon}</span> : icon}
          </div>
        )}

        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
          )}
        </div>
      </header>

      <div className="space-y-4">{children}</div>
    </div>
  );
}
