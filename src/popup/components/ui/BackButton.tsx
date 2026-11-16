import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeftIcon } from '../icons/Icons.js';

/**
 * Канонический «Назад» — единый по всему попапу: шеврон + подпись. Используется
 * и в `DetailPage` (выход с подстраницы), и во внутренней навигации вкладок
 * (например, «Заметки»: из чата к списку), чтобы кнопка везде выглядела одинаково.
 */
interface BackButtonProps {
  onClick: () => void;
  label?: string;
  compact?: boolean;
}

export default function BackButton({ onClick, label, compact = false }: BackButtonProps): React.ReactElement {
  const { t } = useTranslation('common');
  const resolvedLabel = label ?? t('action.back');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={resolvedLabel}
      title={compact ? resolvedLabel : undefined}
      className={`flex items-center justify-center gap-0.5 ${compact ? 'w-8 h-8' : 'pl-1 pr-2 py-1.5'} rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0`}
    >
      <ChevronLeftIcon className="w-5 h-5" />
      {!compact && <span className="text-xs font-medium">{resolvedLabel}</span>}
    </button>
  );
}
