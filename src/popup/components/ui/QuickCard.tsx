import React from 'react';

interface QuickCardProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  isAction?: boolean;
  onClick?: () => void;
  /**
   * 'default' — горизонтальная карточка с подписью, на сером фоне попапа.
   * 'header'  — иконка-в-квадрате 48×48 в синей шапке, рядом с колоколом.
   *             Подпись скрывается, в `title` атрибуте — для tooltip'а.
   */
  variant?: 'default' | 'header';
}

/**
 * В default-режиме: горизонтальная компактная плашка (icon + label + точка),
 * ~36 px высоты — рендерится отдельной секцией под шапкой.
 *
 * В header-режиме: квадратная иконка-кнопка 48×48 (как у колокола уведомлений),
 * без подписи — встраивается прямо в правую группу шапки рядом с bell-кнопкой.
 * Активное состояние — белая заливка с акцентным цветом иконки.
 */
export default function QuickCard({ icon, label, active, isAction, onClick, variant = 'default' }: QuickCardProps) {
  if (variant === 'header') {
    const cls = active
      ? 'bg-white text-primary shadow-md shadow-black/10'
      : 'bg-white/15 backdrop-blur border border-white/20 hover:bg-white/25 text-white';
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className={`
          relative h-12 w-12 rounded-xl flex items-center justify-center
          transition-all duration-150 active:scale-[0.95]
          ${cls}
        `}
      >
        {icon}
      </button>
    );
  }

  const cls = isAction
    ? 'bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-tertiary)] hover:shadow-sm text-[var(--text-secondary)]'
    : active
      ? 'bg-primary text-white shadow-md shadow-primary/20'
      : 'bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary/50 hover:shadow-sm text-[var(--text-secondary)]';

  return (
    <button
      onClick={onClick}
      className={`
        flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-150 active:scale-[0.97]
        ${cls}
      `}
    >
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {icon}
      </span>
      <span className="text-xs font-medium truncate flex-1 text-left">
        {label}
      </span>
      {!isAction && (
        <span
          aria-hidden="true"
          className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${active ? 'bg-white/80' : 'bg-[var(--text-tertiary)]/40'}`}
        />
      )}
    </button>
  );
}
