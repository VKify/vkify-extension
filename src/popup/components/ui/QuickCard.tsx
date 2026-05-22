import React from 'react';

interface QuickCardProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  isAction?: boolean;
  onClick?: () => void;
}

export default function QuickCard({ icon, label, active, isAction, onClick }: QuickCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex flex-col items-center gap-2 py-3.5 px-3 rounded-2xl transition-all duration-200
        ${isAction
          ? 'bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-tertiary)] hover:shadow-sm active:scale-95'
          : active
            ? 'bg-primary text-white shadow-lg shadow-primary/25 active:scale-95'
            : 'bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary/50 hover:shadow-sm active:scale-95'
        }
      `}
    >
      <div className={`${!isAction && !active ? 'text-[var(--text-secondary)]' : ''}`}>
        {icon}
      </div>
      <span className={`text-xs font-medium ${!isAction && !active ? 'text-[var(--text-secondary)]' : ''}`}>
        {label}
      </span>
      {!isAction && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          active
            ? 'bg-white/20 text-white'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
        }`}>
          {active ? 'Вкл' : 'Выкл'}
        </span>
      )}
    </button>
  );
}