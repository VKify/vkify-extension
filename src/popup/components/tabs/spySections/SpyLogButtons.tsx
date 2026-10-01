import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('spy');
  return (
    <div className="spy-log-actions">
      <button
        type="button"
        onClick={onOpenLog}
        className="spy-log-actions__history"
      >
        <ClockIcon className="w-4 h-4" />
        {t('history', { count })}
      </button>
      <button
        type="button"
        aria-label={t('modals:export')}
        title={t('modals:export')}
        onClick={onExport}
        disabled={count === 0}
        className="spy-log-actions__export"
      >
        <DownloadIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
