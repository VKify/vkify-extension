import React from 'react';
import { ChevronRightIcon } from '../icons/Icons.js';

type IconColor = 'green' | 'blue' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

interface ActionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor?: IconColor;
  /** Правый слот — например, badge или переключатель. По умолчанию — шеврон. */
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const ICON_COLORS: Record<IconColor, string> = {
  green:  'bg-success/10 text-success',
  blue:   'bg-primary/10 text-primary',
  red:    'bg-error/10 text-error',
  purple: 'bg-purple-500/10 text-purple-500',
  orange: 'bg-orange-500/10 text-orange-500',
  cyan:   'bg-cyan-500/10 text-cyan-500',
  pink:   'bg-pink-500/10 text-pink-500',
};

export default function ActionCard({
  title,
  description,
  icon,
  iconColor = 'blue',
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
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        danger ? 'bg-error/10 text-error' : ICON_COLORS[iconColor]
      }`}>
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