import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageLoadTiming } from '@/shared/constants/perf.js';
import type { PerfHistoryPoint } from '@/popup/hooks/features/usePerfTelemetry.js';
import { formatMs } from './format.js';

/**
 * Лёгкий sparkline на inline-SVG (без Chart.js): нормализует ряд значений в
 * polyline. Цвет — через currentColor, поэтому управляется классом снаружи.
 */
function Sparkline({ values, className = 'text-primary' }: { values: number[]; className?: string }): React.ReactElement {
  const W = 240;
  const H = 40;

  const path = useMemo(() => {
    if (values.length < 2) return '';
    const max = Math.max(...values, 1);
    const stepX = W / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * stepX;
        const y = H - (v / max) * (H - 4) - 2;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [values]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`w-full h-10 ${className}`}>
      {path ? (
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ) : (
        <line x1={0} y1={H - 2} x2={W} y2={H - 2} stroke="currentColor" strokeWidth={1}
          strokeDasharray="3 3" opacity={0.4} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

interface MiniChartProps {
  title: string;
  current: string;
  values: number[];
  className?: string;
}

function MiniChart({ title, current, values, className }: MiniChartProps): React.ReactElement {
  return (
    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-[var(--text-tertiary)]">{title}</span>
        <span className="text-xs font-semibold text-[var(--text-primary)]">{current}</span>
      </div>
      <Sparkline values={values} className={className} />
    </div>
  );
}

// — Page load timing —

const PHASE_COLORS = ['bg-blue-400', 'bg-cyan-400', 'bg-primary', 'bg-violet-400', 'bg-amber-400', 'bg-green-400'];

function PageLoadBar({ timing }: { timing: PageLoadTiming }): React.ReactElement {
  const { t } = useTranslation('perf');
  const phases = [
    { label: 'DNS', ms: timing.dns },
    { label: 'Connect', ms: timing.connect },
    { label: 'Response', ms: timing.response },
    { label: 'DOM', ms: timing.domInteractive },
    { label: 'DOM complete', ms: timing.domComplete },
    { label: 'Load', ms: timing.load },
  ];
  const sum = phases.reduce((s, p) => s + p.ms, 0) || 1;

  return (
    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[var(--text-tertiary)]">{t('charts.pageLoad')}</span>
        <span className="text-xs font-semibold text-[var(--text-primary)]">{formatMs(timing.total)}</span>
      </div>

      <div className="flex h-3 w-full rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
        {phases.map((p, i) => (
          p.ms > 0 && (
            <div
              key={p.label}
              className={PHASE_COLORS[i % PHASE_COLORS.length]}
              style={{ width: `${(p.ms / sum) * 100}%` }}
              title={`${p.label}: ${formatMs(p.ms)}`}
            />
          )
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-2">
        {phases.map((p, i) => (
          <div key={p.label} className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 rounded-sm flex-shrink-0 ${PHASE_COLORS[i % PHASE_COLORS.length]}`} />
            <span className="text-[10px] text-[var(--text-secondary)] truncate">{p.label}</span>
            <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">{formatMs(p.ms)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PerfChartsProps {
  history: PerfHistoryPoint[];
  pageLoad: PageLoadTiming | null;
  apiCallsLastMin: number;
  observerSubs: number;
}

export default function PerfCharts({ history, pageLoad, apiCallsLastMin, observerSubs }: PerfChartsProps): React.ReactElement {
  const { t } = useTranslation('perf');
  // Частота мутаций — дельта кумулятивного счётчика флашей между тиками.
  const mutationRate = useMemo(() => {
    const out: number[] = [];
    for (let i = 1; i < history.length; i++) {
      out.push(Math.max(0, history[i]!.mutationFlushes - history[i - 1]!.mutationFlushes));
    }
    return out;
  }, [history]);

  const lastMutationRate = mutationRate.length ? mutationRate[mutationRate.length - 1]! : 0;

  return (
    <div className="space-y-2">
      {pageLoad && <PageLoadBar timing={pageLoad} />}

      <MiniChart
        title={t('charts.apiPerMin')}
        current={String(apiCallsLastMin)}
        values={history.map((h) => h.apiCallsLastMin)}
        className="text-primary"
      />
      <MiniChart
        title={t('charts.domMutations')}
        current={String(lastMutationRate)}
        values={mutationRate}
        className="text-violet-500"
      />
      <MiniChart
        title={t('charts.observerSubs')}
        current={String(observerSubs)}
        values={history.map((h) => h.observerSubs)}
        className="text-cyan-500"
      />
    </div>
  );
}
