import React from 'react';
import { SpinnerIcon, UploadIcon } from '../icons/Icons.js';

interface UploadButtonProps {
  label: string;
  loadingLabel: string;
  loading?: boolean;
  onClick: () => void;
}

/** Shared file-upload action used by appearance settings. */
export default function UploadButton({ label, loadingLabel, loading = false, onClick }: UploadButtonProps): React.ReactElement {
  return <button type="button" onClick={onClick} disabled={loading} aria-busy={loading}
    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all
      ${loading ? 'border-primary/50 bg-primary/5' : 'border-[var(--border-color)] hover:border-primary hover:bg-primary/5'}`}>
    {loading ? <>
      <SpinnerIcon className="w-5 h-5 text-primary animate-spin" />
      <span className="text-sm text-primary font-medium">{loadingLabel}</span>
    </> : <>
      <UploadIcon className="w-5 h-5 text-[var(--text-secondary)]" />
      <span className="text-sm text-[var(--text-secondary)] font-medium">{label}</span>
    </>}
  </button>;
}
