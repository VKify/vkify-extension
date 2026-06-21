import React from 'react';
import { ChevronLeftIcon } from '../icons/Icons.js';

/**
 * Канонический «Назад» — единый по всему попапу: шеврон + подпись. Используется
 * и в `DetailPage` (выход с подстраницы), и во внутренней навигации вкладок
 * (например, «Заметки»: из чата к списку), чтобы кнопка везде выглядела одинаково.
 */
interface BackButtonProps {
  onClick: () => void;
  label?: string;
}

export default function BackButton({ onClick, label = 'Назад' }: BackButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex items-center gap-0.5 pl-1 pr-2 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0"
    >
      <ChevronLeftIcon className="w-5 h-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
