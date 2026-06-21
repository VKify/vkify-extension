import React, { useState, useCallback, useMemo } from 'react';
import SettingsSection from '../../ui/SettingsSection.js';
import { ChartIcon, ChevronDownIcon, FilterIcon, TargetIcon } from '../../icons/Icons.js';
import { useBlockStats } from './useBlockStats.js';
import { formatCount, formatTime, triggerColorClass, prettyJson } from './format.js';
import type { StatsLogEntry } from '../../../../types/index.js';

/**
 * Подстраница «Реклама → Статистика и журнал». Тело отдельной страницы функции
 * (см. AdsTab + SubpageHost): счётчики за всё время + фильтруемый журнал
 * блокировок с разворачиваемыми записями.
 */

// ── Stat counter ───────────────────────────────────────────────────────────

function StatCounter({ value, label, icon, accent }: {
  value: number; label: string; icon: React.ReactNode; accent: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-[var(--bg-secondary)]">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none text-[var(--text-primary)]">
          {formatCount(value)}
        </div>
        <div className="text-[11px] mt-1 text-[var(--text-tertiary)] leading-tight">{label}</div>
      </div>
    </div>
  );
}

// ── JSON viewer with copy button ───────────────────────────────────────────

function JsonPayload({ payload }: { payload: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(prettyJson(payload));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [payload]);

  return (
    <div className="relative mt-1.5">
      <pre className="text-[10px] font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-52 p-3 pr-16 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] whitespace-pre">
        {prettyJson(payload)}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-[9px] font-medium px-2 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
      >
        {copied ? '✓ скопировано' : 'копировать'}
      </button>
    </div>
  );
}

// ── Single log entry ───────────────────────────────────────────────────────

function LogEntry({ entry }: { entry: StatsLogEntry }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const isTracker = entry.kind === 'tracker';
  const isApi     = entry.method === 'api';
  const hasTrigger = Boolean(entry.trigger);
  const hasPayload = Boolean(entry.payload);

  /* Expanded body */
  let expandedBody: React.ReactNode = null;
  if (open) {
    if (isApi && hasPayload) {
      // API block: formatted JSON of the blocked post
      expandedBody = <JsonPayload payload={entry.payload!} />;
    } else if (entry.detail) {
      expandedBody = (
        <p className={`text-[10px] leading-relaxed break-words font-mono ${
          isTracker ? 'text-red-500/80 dark:text-red-400/80' : 'text-[var(--text-secondary)]'
        }`}>
          {entry.detail}
        </p>
      );
    } else {
      expandedBody = (
        <p className="text-[10px] italic text-[var(--text-tertiary)]">
          Подробности недоступны
        </p>
      );
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-transparent hover:border-[var(--border-color)] transition-colors">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-2.5 py-2 px-2.5 transition-colors group text-left"
      >
        {/* Kind indicator */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px] ${
          isTracker ? 'bg-red-500' : isApi ? 'bg-indigo-500' : 'bg-amber-500'
        }`} />

        <div className="flex-1 min-w-0">
          {/* Row 1: domain · badges · time · chevron */}
          <div className="flex items-center gap-1.5">
            <span className="flex-1 truncate text-[11px] font-mono text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors min-w-0">
              {entry.domain}
            </span>

            {/* method badge */}
            {entry.method && (
              <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                isApi
                  ? 'bg-indigo-500/10 text-indigo-500'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {entry.method}
              </span>
            )}

            {/* kind badge */}
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md flex-shrink-0 ${
              isTracker
                ? 'bg-red-500/10 text-red-500'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {isTracker ? 'трекер' : 'пост'}
            </span>

            <span className="flex-shrink-0 text-[10px] text-[var(--text-tertiary)] tabular-nums">
              {formatTime(entry.time)}
            </span>
            <ChevronDownIcon className={`w-3 h-3 flex-shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
          </div>

          {/* Row 2: trigger / ad-type label */}
          {hasTrigger && (
            <p className={`text-[10px] leading-tight mt-0.5 font-medium truncate ${triggerColorClass(entry.trigger!)}`}>
              {entry.trigger}
            </p>
          )}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-3 pb-2.5">
          {expandedBody}
        </div>
      )}
    </div>
  );
}

// ── Filter pill ────────────────────────────────────────────────────────────

type LogFilter = 'all' | 'ad' | 'tracker';
const LOG_PAGE = 10;

function FilterPill({
  label, active, count, onClick,
}: {
  label: string; active: boolean; count: number; onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
    </button>
  );
}

// ── Log section ────────────────────────────────────────────────────────────

function LogSection({ log }: { log: StatsLogEntry[] }): React.ReactElement {
  const [filter, setFilter]     = useState<LogFilter>('all');
  const [visibleCount, setVisible] = useState(LOG_PAGE);

  const counts = useMemo(() => ({
    all:     log.length,
    ad:      log.filter(e => e.kind === 'ad').length,
    tracker: log.filter(e => e.kind === 'tracker').length,
  }), [log]);

  const filtered = useMemo(
    () => filter === 'all' ? log : log.filter(e => e.kind === filter),
    [log, filter],
  );

  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  const handleFilter = useCallback((f: LogFilter) => {
    setFilter(f);
    setVisible(LOG_PAGE);
  }, []);

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-color)]">

      {/* Header + filter pills */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
          Журнал блокировок
        </p>
        <div className="flex items-center gap-1">
          <FilterPill label="Все"      active={filter === 'all'}     count={counts.all}     onClick={() => handleFilter('all')} />
          <FilterPill label="Реклама"  active={filter === 'ad'}      count={counts.ad}      onClick={() => handleFilter('ad')} />
          <FilterPill label="Трекеры" active={filter === 'tracker'} count={counts.tracker} onClick={() => handleFilter('tracker')} />
        </div>
      </div>

      {/* Entries */}
      {visible.length === 0 ? (
        <p className="text-[11px] text-[var(--text-tertiary)] text-center py-3 italic">
          {filter === 'all' ? 'Список пуст' : 'Нет записей этого типа'}
        </p>
      ) : (
        <div className="space-y-0.5">
          {visible.map((entry, i) => (
            <LogEntry key={`${entry.time}-${i}`} entry={entry} />
          ))}
        </div>
      )}

      {/* Load more */}
      {remaining > 0 && (
        <button
          onClick={() => setVisible(v => v + LOG_PAGE)}
          className="mt-2 w-full py-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors rounded-lg hover:bg-[var(--bg-secondary)]"
        >
          Загрузить ещё {Math.min(remaining, LOG_PAGE)} из {remaining}
        </button>
      )}
    </div>
  );
}

// ── Subpage: statistics + block log ────────────────────────────────────────

export default function AdsStatsPage(): React.ReactElement {
  const { trackersBlocked, adsBlocked, blockLog, reset } = useBlockStats();
  const totalBlocked = trackersBlocked + adsBlocked;

  return (
    <div className="space-y-5">
      <SettingsSection
        title="Статистика"
        description={totalBlocked > 0 ? `${formatCount(totalBlocked)} заблокировано всего` : 'Накоплено за всё время'}
        icon={<ChartIcon className="w-5 h-5" />}
        iconColor="purple"
        action={totalBlocked > 0 && (
          <button
            onClick={() => void reset()}
            className="text-xs text-[var(--text-tertiary)] hover:text-error transition-colors px-2 py-1 rounded-lg hover:bg-error/5 active:scale-95"
          >
            Сбросить
          </button>
        )}
      >
        <div className="px-4 pb-4">
          {totalBlocked === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-3">
              Здесь появится статистика после включения блокировщиков
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <StatCounter
                value={trackersBlocked}
                label="трекеров заблокировано"
                icon={<TargetIcon className="w-4 h-4 text-red-500" />}
                accent="bg-red-500/10"
              />
              <StatCounter
                value={adsBlocked}
                label="рекламных постов скрыто"
                icon={<FilterIcon className="w-4 h-4 text-amber-500" />}
                accent="bg-amber-500/10"
              />
            </div>
          )}

          {blockLog.length > 0 && <LogSection log={blockLog} />}
        </div>
      </SettingsSection>
    </div>
  );
}
