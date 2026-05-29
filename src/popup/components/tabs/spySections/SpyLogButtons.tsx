import React from 'react';
import { ClockIcon, DownloadIcon } from '../../icons/Icons.js';

/**
 * Ряд кнопок «История (N)» + экспорт под секцией слежки. Один и тот же блок
 * присутствовал во всех трёх секциях (активность/онлайн/профили) — вынесен,
 * чтобы не дублировать разметку и поведение.
 */
export default function SpyLogButtons({
  count,
  onOpenLog,
  onExport,
}: {
  count: number;
  onOpenLog: () => void;
  onExport: () => void;
}) {
  return (
    <div className="mx-4 mb-4 flex gap-2">
      <button
        onClick={onOpenLog}
        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
      >
        <ClockIcon className="w-4 h-4" />
        История ({count})
      </button>
      <button
        onClick={onExport}
        disabled={count === 0}
        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
      >
        <DownloadIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
