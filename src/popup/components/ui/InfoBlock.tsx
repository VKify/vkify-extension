import React from 'react';
import { XIcon } from '../icons/Icons.js';

type InfoBlockVariant = 'tip' | 'info' | 'warning' | 'error' | 'success' | 'skeleton';

interface InfoBlockProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  variant?: InfoBlockVariant;
  className?: string;
  onDismiss?: () => void;
}

const VARIANTS: Record<InfoBlockVariant, {
  bg: string;
  border: string;
  iconBg: string;
  iconText: string;
  titleColor: string;
  bar: string;
  glow: string;
}> = {
  tip: {
    bg:        'bg-primary/10',
    border:    'border-primary/25',
    iconBg:    'bg-primary/15',
    iconText:  'text-primary',
    titleColor:'text-primary',
    bar:       'bg-primary',
    glow:      'shadow-primary/10',
  },
  info: {
    bg:        'bg-purple-500/10',
    border:    'border-purple-500/25',
    iconBg:    'bg-purple-500/15',
    iconText:  'text-purple-500',
    titleColor:'text-purple-500',
    bar:       'bg-purple-500',
    glow:      'shadow-purple-500/10',
  },
  warning: {
    bg:        'bg-amber-500/10',
    border:    'border-amber-500/30',
    iconBg:    'bg-amber-500/15',
    iconText:  'text-amber-500',
    titleColor:'text-amber-500',
    bar:       'bg-amber-500',
    glow:      'shadow-amber-500/10',
  },
  error: {
    bg:        'bg-red-500/10',
    border:    'border-red-500/25',
    iconBg:    'bg-red-500/15',
    iconText:  'text-red-500',
    titleColor:'text-red-500',
    bar:       'bg-red-500',
    glow:      'shadow-red-500/10',
  },
  success: {
    bg:        'bg-emerald-500/10',
    border:    'border-emerald-500/25',
    iconBg:    'bg-emerald-500/15',
    iconText:  'text-emerald-500',
    titleColor:'text-emerald-500',
    bar:       'bg-emerald-500',
    glow:      'shadow-emerald-500/10',
  },
  skeleton: {
    bg:        'bg-orange-500/10',
    border:    'border-orange-500/25',
    iconBg:    'bg-orange-500/15',
    iconText:  'text-orange-500',
    titleColor:'text-orange-500',
    bar:       'bg-orange-500',
    glow:      'shadow-orange-500/10',
  },
};

export default function InfoBlock({
  icon,
  title,
  children,
  variant = 'info',
  className = '',
  onDismiss,
}: InfoBlockProps) {
  const v = VARIANTS[variant];

  return (
    <div className={`relative flex gap-3 p-4 rounded-2xl overflow-hidden border shadow-sm ${v.bg} ${v.border} ${v.glow} ${className}`}>
      {/* Цветная полоска слева */}
      <div className={`absolute left-0 inset-y-3 w-[3px] rounded-r-full ${v.bar}`} />

      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base leading-none ${v.iconBg} ${v.iconText}`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className={`text-xs font-bold ${v.titleColor} mb-1 tracking-wide`}>
          {title}
        </div>
        <div className="text-xs text-[var(--text-primary)] opacity-75 leading-relaxed">
          {children}
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Закрыть"
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-lg
            text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]
            hover:bg-[var(--bg-tertiary)] transition-colors self-start"
        >
          <XIcon className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}