import React from 'react';
import { ChevronRightIcon } from '../icons/Icons.js';

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Правый слот — например, badge или переключатель. По умолчанию — шеврон. */
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export default function ActionCard({
  title,
  description,
  icon,
  right,
  danger = false,
  disabled = false,
  onClick,
}: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left active:scale-[0.98]',
        disabled
          ? 'opacity-40 cursor-not-allowed border-[var(--border-color)]'
          : danger
            ? 'border-error/20 hover:border-error/40 hover:bg-error/5'
            : 'border-[var(--border-color)] hover:border-[var(--border-color)] hover:bg-[var(--bg-secondary)]',
      ].join(' ')}
    >
      <div className="dashboard-icon dashboard-icon--primary">
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium leading-tight ${danger ? 'text-error' : 'text-[var(--text-primary)]'}`}>
          {title}
        </div>
        <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
          {description}
        </div>
      </div>

      {right !== undefined
        ? right
        : <ChevronRightIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
      }
    </button>
  );
}
