import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDialogStats } from '@/popup/hooks/features/useDialogStats.js';
import { activityMetrics, DIALOG_STATS_EXACT_LIMIT } from '@/shared/dialog-stats.js';
import { downloadText } from '@/shared/utils/download.js';
import { StatisticsIcon, RefreshIcon, DownloadIcon, SearchIcon, ClockIcon, MessengerIcon, ArrowUpIcon, CheckCircleIcon, XIcon } from '@/popup/components/icons/Icons.js';
import { AGE_BUCKETS, ageBucket, filterStats, statsCsv, type AgeBucket, type StatsFilter } from './statsView.js';
import StatsDialogCard from './StatsDialogCard.js';
import './messages-stats.css';

export default function MessagesStatsPage(): React.ReactElement {
  const { t, i18n } = useTranslation('center');
  const { state, pending, error, action } = useDialogStats();
  const [threshold, setThreshold] = useState(90);
  const [filter, setFilter] = useState<StatsFilter>('all');
  const [sort, setSort] = useState('count');
  const [search, setSearch] = useState('');
  const [age, setAge] = useState<AgeBucket | null>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<'quick' | 'exact'>('quick');
  const [compact, setCompact] = useState(false);
  const [selection, setSelection] = useState<{ owner: string; ids: number[] }>({ owner: '', ids: [] });
  const running = pending || state.status === 'running';
  const rows = useMemo(() => state.rows.map(row => activityMetrics(row, threshold)), [state.rows, threshold]);
  const filtered = useMemo(() => filterStats(rows, filter, search, age, sort), [rows, filter, search, age, sort]);
  const selected = useMemo(() => new Set(selection.owner === state.ownerId
    ? selection.ids.filter(id => rows.some(row => row.peerId === id)) : []), [selection, state.ownerId, rows]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  const visible = filtered.slice(safePage * 20, (safePage + 1) * 20);
  const targets = selected.size ? [...selected] : visible.map(row => row.peerId);
  const exactCount = rows.filter(row => row.countExact).length;
  const maxCount = rows.reduce((max, row) => Math.max(max, row.approxMessageCount ?? 0), 1);
  const summary = [
    { key: 'all', value: rows.length, icon: MessengerIcon, tone: 'blue' },
    { key: 'dead', value: rows.filter(row => row.isDead).length, icon: ClockIcon, tone: 'warm' },
    { key: 'in', value: rows.filter(row => row.type === 'user' && row.lastDirection === 'in').length, icon: MessengerIcon, tone: 'violet' },
    { key: 'out', value: rows.filter(row => row.type === 'user' && row.lastDirection === 'out').length, icon: ArrowUpIcon, tone: 'green' },
  ] as const;
  const buckets = AGE_BUCKETS.map(key => ({ key, count: rows.filter(row => ageBucket(row) === key).length }));
  const maxBucket = Math.max(1, ...buckets.map(bucket => bucket.count));
  const number = (value: number) => value.toLocaleString(i18n.resolvedLanguage);
  const reset = () => { setFilter('all'); setAge(null); setSearch(''); setPage(0); };
  const hasFilters = filter !== 'all' || age !== null || search.trim() !== '';
  const selectFilter = (value: StatsFilter) => { setFilter(value); setPage(0); };
  useEffect(() => { setPage(0); }, [state.ownerId]);
  const toggle = (id: number) => {
    const ids = new Set(selected);
    if (ids.has(id)) ids.delete(id);
    else if (ids.size < DIALOG_STATS_EXACT_LIMIT) ids.add(id);
    setSelection({ owner: state.ownerId, ids: [...ids] });
  };
  const exportCsv = () => {
    const exportRows = selected.size ? rows.filter(row => selected.has(row.peerId)) : filtered;
    downloadText(statsCsv(exportRows), 'vkify-dialog-stats-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv');
  };

  return <div className="dialog-stats" data-vkify-anchor="messages-stats">
    <section className="ds-overview" aria-label={t('stats.overview')}>
      <div className="ds-overview-head">
        <div className="ds-heading"><span className="ds-icon-tile"><StatisticsIcon /></span>
          <div><h3>{t('stats.overview')}</h3><p>{t('stats.overview_hint')}</p></div>
        </div>
        <button className="ds-button ds-icon-button" aria-label={t('stats.refresh')} title={t('stats.refresh')} disabled={running}
          onClick={() => { setSelection({ owner: state.ownerId, ids: [] }); setMode('quick'); void action('refresh'); }}><RefreshIcon /></button>
      </div>
      <div className="ds-summary">
        {summary.map(({ key, value, icon: Icon, tone }) => <button key={key} className={'ds-metric ds-tone-' + tone}
          aria-pressed={filter === key} onClick={() => { selectFilter(key); setAge(null); setSearch(''); }}>
          <span className="ds-metric-top"><Icon /><span>{rows.length ? Math.round(value / rows.length * 100) : 0}%</span></span>
          <strong>{number(value)}</strong><span>{t('stats.summary.' + key)}</span>
        </button>)}
      </div>
      <div className="ds-freshness"><span className="ds-dot" />{state.collectedAt
        ? t('stats.updated', { date: new Date(state.collectedAt).toLocaleString(i18n.resolvedLanguage, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })
        : t('stats.status.' + state.status)}<span className="ds-freshness-end">{t('stats.exact_coverage', { count: exactCount, total: rows.length })}</span></div>
    </section>

    <section className="ds-panel ds-activity" aria-label={t('stats.activity_title')}>
      <div className="ds-section-heading"><h3>{t('stats.activity_title')}</h3><span>{t('stats.activity_hint')}</span></div>
      <div className="ds-histogram">
        {buckets.map(({ key, count }) => <button key={key} className={'ds-bucket ds-bucket-' + key} aria-pressed={age === key}
          onClick={() => { setAge(age === key ? null : key); setPage(0); }}>
          <span className="ds-bar-count">{number(count)}</span>
          <span className="ds-bar-track"><span className="ds-bar" style={{ height: (count ? Math.max(6, count / maxBucket * 100) : 0) + '%' }} /></span>
          <span className="ds-bucket-label">{t('stats.buckets.' + key)}</span>
        </button>)}
      </div>
    </section>

    <section className="ds-panel ds-controls" aria-label={t('stats.settings')}>
      <div className="ds-control-row">
        <div className="ds-mode" role="group" aria-label={t('stats.mode')}>
          {(['quick', 'exact'] as const).map(value => <button key={value} aria-pressed={mode === value} disabled={running}
            onClick={() => setMode(value)}>{value === 'exact' && <CheckCircleIcon />}{t('stats.' + value)}</button>)}
        </div>
        <label className="ds-threshold"><span>{t('stats.threshold')}</span>
          <select value={threshold} onChange={event => { setThreshold(Number(event.target.value)); setPage(0); }}>
            {[30, 60, 90, 180].map(value => <option key={value} value={value}>{t('stats.days', { count: value })}</option>)}
          </select>
        </label>
      </div>
      {mode === 'exact' && <div className="ds-exact-action"><p>{t('stats.exact_hint')}</p>
        <button className="ds-button ds-button-primary" disabled={running || !state.collectedAt || !targets.length}
          onClick={() => void action('exact', targets)}><CheckCircleIcon />{t(selected.size ? 'stats.refine_selected' : 'stats.refine', { count: targets.length })}</button>
      </div>}
      <details className="ds-explanation"><summary>{t('stats.how_counted')}</summary><p>{t('stats.estimate_note')}</p><p>{t('stats.reply_note')}</p></details>
      {(running || state.status === 'failed' || state.status === 'cancelled') && <div className="ds-progress" role="status" aria-live="polite">
        <div><span>{t('stats.status.' + state.status)}</span>{state.status === 'running' && <b>{state.completed} / {state.total || '…'}</b>}</div>
        {state.status === 'running' && <><progress value={state.completed} max={Math.max(state.total, state.completed, 1)} />
          <button className="ds-button" disabled={pending} onClick={() => void action('cancel')}>{t('stats.cancel')}</button></>}
      </div>}
      {error && <p role="alert" className="ds-error">{t(error === 'AUTH_REQUIRED' ? 'stats.auth_error' : 'stats.error')}</p>}
    </section>

    <section className="ds-results" aria-label={t('stats.dialogs')}>
      <div className="ds-section-heading"><h3>{t('stats.dialogs')} <span className="ds-result-count">{number(filtered.length)}</span></h3>
        <button className="ds-button" disabled={!filtered.length && !selected.size} onClick={exportCsv}><DownloadIcon />{t(selected.size ? 'stats.export_selected' : 'stats.export_csv')}</button>
      </div>
      <div className="ds-search"><SearchIcon /><input value={search} aria-label={t('stats.search')} placeholder={t('stats.search')}
        onChange={event => { setSearch(event.target.value); setPage(0); }} />
        {search && <button aria-label={t('stats.clear_search')} onClick={() => { setSearch(''); setPage(0); }}><XIcon /></button>}
      </div>
      <div className="ds-filter-row">
        <select value={filter} aria-label={t('stats.filter')} onChange={event => selectFilter(event.target.value as StatsFilter)}>
          {(['all', 'dead', 'user', 'group', 'in', 'out', 'unread', 'exact'] as const).map(key => <option key={key} value={key}>{t('stats.filters.' + key)}</option>)}
        </select>
        <select value={sort} aria-label={t('stats.sort')} onChange={event => { setSort(event.target.value); setPage(0); }}>
          {['count', 'days', 'date', 'unread'].map(key => <option key={key} value={key}>{t('stats.sorts.' + key)}</option>)}
        </select>
      </div>
      <div className="ds-list-options"><label><input type="checkbox" checked={compact} onChange={event => setCompact(event.target.checked)} />{t('stats.compact')}</label>
        {hasFilters && <button onClick={reset}>{t('stats.reset_filters')}</button>}
      </div>
      {age && <button className="ds-active-filter" onClick={() => { setAge(null); setPage(0); }}>{t('stats.buckets.' + age)}<XIcon /></button>}
      {(visible.length > 0 || selected.size > 0) && <div className="ds-selection">
        <div><strong>{t('stats.selected', { count: selected.size, max: DIALOG_STATS_EXACT_LIMIT })}</strong>
          <span>{t('stats.selection_hint')}</span></div>
        <button className="ds-button" disabled={running} onClick={() => setSelection({ owner: state.ownerId, ids: selected.size ? [] : visible.map(row => row.peerId) })}>
          {t(selected.size ? 'stats.clear_selection' : 'stats.select_page')}</button>
      </div>}
      <ul className="ds-list">{visible.map((row, index) => <StatsDialogCard key={state.ownerId + ':' + row.peerId}
        row={row} rank={safePage * 20 + index + 1} maxCount={maxCount} selected={selected.has(row.peerId)} compact={compact}
        disabled={running || !selected.has(row.peerId) && selected.size >= DIALOG_STATS_EXACT_LIMIT} toggle={() => toggle(row.peerId)} />)}</ul>
      {!visible.length && <div className="ds-empty"><SearchIcon /><h3>{t(running ? 'stats.wait' : 'stats.empty')}</h3>
        <p>{t(hasFilters ? 'stats.empty_filters' : 'stats.empty_hint')}</p>{hasFilters && <button className="ds-button" onClick={reset}>{t('stats.reset_filters')}</button>}</div>}
      {filtered.length > 20 && <div className="ds-pagination">
        <button className="ds-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t('stats.previous')}</button>
        <span>{safePage + 1} / {Math.ceil(filtered.length / 20)}</span>
        <button className="ds-button" disabled={(safePage + 1) * 20 >= filtered.length} onClick={() => setPage(safePage + 1)}>{t('stats.next')}</button>
      </div>}
    </section>
  </div>;
}
