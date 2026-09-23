import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AccountBackupState } from '@/shared/account-backup.js';

export default function BackupProgress({ state }: { state: AccountBackupState }): React.ReactElement {
  const { t } = useTranslation('center');
  return (
    <div className="px-4 py-4 space-y-2" aria-live="polite">
      <div className="flex justify-between gap-3 text-xs">
        <span className="font-medium text-[var(--text-primary)]">
          {state.currentSection
            ? t(`backup.progress.${state.currentSection}`)
            : t(`backup.status.${state.status}`)}
        </span>
        <span className="text-[var(--text-secondary)]">{state.progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${state.progress}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={state.progress}
        />
      </div>
      {state.error && <p className="text-xs text-red-500 break-words">{state.error}</p>}
    </div>
  );
}
