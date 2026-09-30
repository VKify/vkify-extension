import React from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '../icons/Icons.js';

type InfoBlockVariant = 'tip' | 'info' | 'warning' | 'error' | 'success';

interface InfoBlockProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  variant?: InfoBlockVariant;
  className?: string;
  onDismiss?: () => void;
}

export default function InfoBlock({
  icon,
  title,
  children,
  variant: _variant = 'info',
  className = '',
  onDismiss,
}: InfoBlockProps) {
  const { t } = useTranslation('common');
  return (
    <div className={`relative flex gap-3 p-4 rounded-2xl overflow-hidden border border-primary/20 bg-primary/10 ${className}`}>
      <div className="dashboard-icon dashboard-icon--small dashboard-icon--primary">
        {icon}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-xs font-bold text-primary mb-1 tracking-wide">
          {title}
        </div>
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed"
          title={typeof children === 'string' ? children : undefined}>
          {children}
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label={t('action.close')}
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
