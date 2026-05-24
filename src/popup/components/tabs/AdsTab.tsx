import React, { useState, useCallback, useRef, useMemo } from 'react';
import SettingRow from '../ui/SettingRow.js';
import {
  BanIcon, ShieldIcon, SidebarIcon, FilterIcon, ActivityIcon,
  ChartIcon, ChevronDownIcon,
} from '../icons/Icons.js';
import { useAdsBlocking } from '../../hooks/features/useAdsBlocking.js';
import { useSettings } from '../../context/SettingsContext.js';
import type { StatsLogEntry } from '../../../types/index.js';

// ── Divider between SettingRows ────────────────────────────────────────────

function RowDivider(): React.ReactElement {
  return <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Maps a trigger string to a Tailwind colour class.
 * Hard/certain signals → rose, heuristic → amber, domain/custom → other.
 */
function triggerColorClass(trigger: string): string {
  if (trigger.startsWith('Маркер')          ||
      trigger.startsWith('Нативная')        ||
      trigger.startsWith('aria-label'))       return 'text-rose-500 dark:text-rose-400';
  if (trigger.startsWith('Рекламный домен')) return 'text-orange-500 dark:text-orange-400';
  if (trigger.startsWith('Стоп-слово'))     return 'text-violet-500 dark:text-violet-400';
  if (trigger.startsWith('«реклам»')        ||
      trigger.startsWith('CTA')             ||
      trigger.startsWith('Обфусц'))          return 'text-amber-600 dark:text-amber-400';
  return 'text-indigo-400 dark:text-indigo-300'; // API ad type
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

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

// ── Log section ────────────────────────────────────────────────────────────

const LOG_PAGE = 10;
type LogFilter = 'all' | 'ad' | 'tracker';

/** Pretty-prints a JSON string; falls back to raw string on parse error. */
function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
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

// ── Keyword list ───────────────────────────────────────────────────────────

interface KeywordListProps {
  label: string;
  placeholder: string;
  words: string[];
  tagClass: string;
  onAdd: (w: string) => void;
  onRemove: (w: string) => void;
}

function KeywordList({ label, placeholder, words, tagClass, onAdd, onRemove }: KeywordListProps): React.ReactElement {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const word = input.trim().toLowerCase();
    if (!word || words.includes(word)) { setInput(''); return; }
    onAdd(word);
    setInput('');
    inputRef.current?.focus();
  }, [input, words, onAdd]);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </p>

      {words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {words.map(word => (
            <span key={word} className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${tagClass}`}>
              {word}
              <button
                onClick={() => onRemove(word)}
                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity text-sm leading-none"
                aria-label={`Удалить «${word}»`}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-xs bg-[var(--bg-secondary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--border-color)] placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)]"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-all active:scale-95 whitespace-nowrap"
        >
          + Добавить
        </button>
      </form>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AdsTab(): React.ReactElement {
  const { allBlocked, handleBlockAll, activeCount, totalCount } = useAdsBlocking();
  const { settings, saveMultiple, saveSetting } = useSettings();

  // Stats
  const trackersBlocked = (settings['stats_trackers_blocked'] as number) ?? 0;
  const adsBlocked      = (settings['stats_ads_blocked']      as number) ?? 0;
  const blockLog        = (settings['stats_block_log'] as StatsLogEntry[]) ?? [];
  const totalBlocked    = trackersBlocked + adsBlocked;

  // Feature flags
  const domEnabled = settings['block_feed_ads_dom'] === true;

  // Keywords
  const blockWords = (settings['custom_block_words'] as string[]) ?? [];
  const allowWords = (settings['custom_allow_words'] as string[]) ?? [];

  const handleResetStats = useCallback(async () => {
    await saveMultiple({ stats_trackers_blocked: 0, stats_ads_blocked: 0, stats_block_log: [] });
  }, [saveMultiple]);

  const handleAddBlockWord    = useCallback((w: string) => void saveSetting('custom_block_words', [...blockWords, w]), [blockWords, saveSetting]);
  const handleRemoveBlockWord = useCallback((w: string) => void saveSetting('custom_block_words', blockWords.filter(x => x !== w)), [blockWords, saveSetting]);
  const handleAddAllowWord    = useCallback((w: string) => void saveSetting('custom_allow_words', [...allowWords, w]), [allowWords, saveSetting]);
  const handleRemoveAllowWord = useCallback((w: string) => void saveSetting('custom_allow_words', allowWords.filter(x => x !== w)), [allowWords, saveSetting]);

  const shieldColor = activeCount === totalCount ? 'text-emerald-500' : activeCount > 0 ? 'text-primary' : 'text-[var(--text-tertiary)]';
  const shieldBg    = activeCount === totalCount ? 'bg-emerald-500/10' : activeCount > 0 ? 'bg-primary/10' : 'bg-[var(--bg-secondary)]';

  return (
    <div className="space-y-4">

      {/* ── Blocking section ─────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${shieldBg}`}>
              <ShieldIcon className={`w-5 h-5 ${shieldColor}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Блокировка рекламы</h3>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {activeCount === 0
                  ? 'Все фильтры отключены'
                  : activeCount === totalCount
                    ? 'Все фильтры активны'
                    : `Активно ${activeCount} из ${totalCount} фильтров`}
              </p>
            </div>
          </div>
          <button
            onClick={handleBlockAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-95 ${
              allBlocked ? 'text-error hover:bg-error/5' : 'text-success hover:bg-success/5'
            }`}
          >
            <BanIcon className="w-3.5 h-3.5" />
            {allBlocked ? 'Отключить всё' : 'Включить всё'}
          </button>
        </div>

        <SettingRow
          id="block_left_ads"
          title="Боковая панель"
          description="Скрывает рекламные баннеры и виджеты в левой колонке"
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <RowDivider />
        <SettingRow
          id="block_feed_ads_api"
          title="Лента · фильтр API"
          description="Перехватывает рекламные посты на уровне сетевых запросов"
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <RowDivider />
        <SettingRow
          id="block_feed_ads_dom"
          title="Лента · фильтр DOM"
          description="Скрывает рекламные посты через CSS и анализ содержимого"
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="red"
        />

        {/* ── Keyword lists — visible only when DOM filter is on ── */}
        {domEnabled && (
          <div className="px-4 pb-4 pt-3 space-y-4 border-t border-[var(--border-color)]">
            <KeywordList
              label="Скрывать посты со словами"
              placeholder="нпр: казино, вебинар, кредит..."
              words={blockWords}
              tagClass="bg-red-500/10 text-red-600 dark:text-red-400"
              onAdd={handleAddBlockWord}
              onRemove={handleRemoveBlockWord}
            />
            <div className="border-t border-[var(--border-color)] opacity-50" />
            <KeywordList
              label="Всегда показывать посты со словами"
              placeholder="нпр: vkify, мой блог..."
              words={allowWords}
              tagClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              onAdd={handleAddAllowWord}
              onRemove={handleRemoveAllowWord}
            />
          </div>
        )}

        <RowDivider />
        <SettingRow
          id="block_trackers"
          title="Блокировка трекеров"
          description="Перехватывает аналитику, телеметрию и рекламные сети"
          icon={<ActivityIcon className="w-5 h-5" />}
          iconColor="red"
        />
      </section>

      {/* ── Status banner ────────────────────────────────────────────────── */}
      <section className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
        activeCount === totalCount
          ? 'bg-emerald-500/10'
          : activeCount > 0
            ? 'bg-primary/10'
            : 'bg-[var(--bg-secondary)]'
      }`}>
        <ShieldIcon className={`w-5 h-5 flex-shrink-0 ${shieldColor}`} />
        <div>
          <p className={`text-sm font-semibold ${shieldColor}`}>
            {activeCount === totalCount
              ? 'Полная защита'
              : activeCount > 0
                ? 'Частичная защита'
                : 'Защита отключена'}
          </p>
          <p className={`text-[11px] opacity-70 ${shieldColor}`}>
            {activeCount === 0
              ? 'Включите фильтры выше'
              : activeCount === totalCount
                ? 'Все фильтры активны'
                : `Активно ${activeCount} из ${totalCount} фильтров`}
          </p>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
              <ChartIcon className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Статистика</h3>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {totalBlocked > 0 ? `${formatCount(totalBlocked)} заблокировано всего` : 'Накоплено за всё время'}
              </p>
            </div>
          </div>
          {totalBlocked > 0 && (
            <button
              onClick={handleResetStats}
              className="text-xs text-[var(--text-tertiary)] hover:text-error transition-colors px-2 py-1 rounded-lg hover:bg-error/5 active:scale-95"
            >
              Сбросить
            </button>
          )}
        </div>

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
                icon={<ActivityIcon className="w-4 h-4 text-red-500" />}
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
      </section>

    </div>
  );
}