import React from 'react';
import { RefreshIcon } from '../icons/Icons.js';

/**
 * Единая кнопка «Сбросить» для всех разделов оформления. Подстраивается под
 * акцент темы (`--primary`): иконка обновления + подпись на полупрозрачной
 * акцентной подложке. Один вид во всех местах сброса вместо разнородных
 * красных/серых кнопок.
 */
interface ResetButtonProps {
  onClick: (e: React.MouseEvent) => void;
  /** Подпись. По умолчанию «Сбросить». */
  label?: string;
  /** Доп. классы (например, для позиционирования). */
  className?: string;
  'aria-label'?: string;
  title?: string;
}

export default function ResetButton({
  onClick,
  label = 'Сбросить',
  className = '',
  title,
  'aria-label': ariaLabel,
}: ResetButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? label}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
        text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20
        transition-colors active:scale-95 ${className}`}
    >
      <RefreshIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
