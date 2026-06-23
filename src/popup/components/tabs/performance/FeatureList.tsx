import React, { useMemo } from 'react';
import type { FeaturePerf } from '@/shared/constants/perf.js';
import Toggle from '../../ui/Toggle.js';
import { useSettings } from '@/popup/context/SettingsContext.js';
import { formatMs, IMPACT_BADGE, IMPACT_LABEL, IMPACT_ORDER } from './format.js';

interface FeatureListProps {
  features: FeaturePerf[];
}

/**
 * Список активных фич с impact-бейджем, метриками (init / runtime) и тогглом.
 * Тоггл пишет boolean в settings[id] — content-скрипт сам включит/выключит фичу
 * через storage.onChanged (тот же путь, что у всех настроек попапа).
 */
export default function FeatureList({ features }: FeatureListProps): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  const sorted = useMemo(
    () =>
      [...features].sort(
        (a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || b.runtimeMs - a.runtimeMs,
      ),
    [features],
  );

  const counts = useMemo(() => {
    const c = { heavy: 0, medium: 0, light: 0 };
    for (const f of features) c[f.impact]++;
    return c;
  }, [features]);

  if (sorted.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
        Нет активных фич на странице
      </div>
    );
  }

  return (
    <>
      {/* Сводка: сколько фич и как распределены по impact — видна сразу, не
          требует прокрутки всего списка. */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2.5">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{sorted.length} активно</span>
        {counts.heavy > 0 && (
          <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${IMPACT_BADGE.heavy}`}>{counts.heavy} тяж.</span>
        )}
        {counts.medium > 0 && (
          <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${IMPACT_BADGE.medium}`}>{counts.medium} ср.</span>
        )}
        {counts.light > 0 && (
          <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${IMPACT_BADGE.light}`}>{counts.light} лёг.</span>
        )}
      </div>

      {/* Ограничиваем высоту: длинный список прокручивается ВНУТРИ секции, а не
          растягивает всю страницу дашборда (иначе контролы уезжают вниз). */}
      <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-color)] border-t border-[var(--border-color)]">
        {sorted.map((f) => (
        <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{f.label}</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded ${IMPACT_BADGE[f.impact]}`}>
                {IMPACT_LABEL[f.impact]}
              </span>
            </div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
              init {formatMs(f.initMs)} · runtime {formatMs(f.runtimeMs)}
            </div>
          </div>

          <Toggle
            size="small"
            checked={!!settings[f.id]}
            onChange={(val) => void saveSetting(f.id, val)}
          />
        </div>
        ))}
      </div>
    </>
  );
}
