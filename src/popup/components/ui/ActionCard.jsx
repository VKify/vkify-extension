import React from 'react';
import { ChevronRightIcon } from '../icons/Icons';

export default function ActionCard({ 
  title, 
  description, 
  icon: Icon, 
  iconColor = 'green',
  danger = false,
  onClick 
}) {
  const iconColorClasses = {
    green: 'bg-success/10 text-success',
    blue: 'bg-primary/10 text-primary',
    red: 'bg-error/10 text-error',
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
        ${danger 
          ? 'border-error/20 hover:border-error/40 hover:bg-error/5' 
          : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]'}
      `}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconColorClasses[iconColor]}`}>
        {Icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${danger ? 'text-error' : 'text-[var(--text-primary)]'}`}>
          {title}
        </div>
        <div className="text-xs text-[var(--text-secondary)] truncate">
          {description}
        </div>
      </div>
      <ChevronRightIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
    </button>
  );
}