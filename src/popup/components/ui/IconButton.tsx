import React from 'react';

interface IconButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
  /** `danger` красит hover в цвет ошибки (для деструктивных действий). */
  variant?: 'default' | 'danger';
  /** Доп. классы — фон/тень/скругление задаёт вызывающая сторона. */
  className?: string;
}

/**
 * Квадратная иконочная кнопка панели инструментов CSS-редактора.
 * Вынесена, чтобы не дублировать одинаковую разметку у каждой кнопки
 * (отменить/повторить/форматировать/копировать/очистить).
 */
export default function IconButton({
  onClick,
  title,
  children,
  disabled = false,
  variant = 'default',
  className = '',
}: IconButtonProps): React.ReactElement {
  const hover = variant === 'danger'
    ? 'hover:text-error'
    : 'hover:text-[var(--text-primary)]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-2 text-[var(--text-secondary)] ${hover}
        disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors ${className}
      `}
    >
      {children}
    </button>
  );
}
