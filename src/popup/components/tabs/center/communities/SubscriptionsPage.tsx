import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubscriptions } from '@/popup/hooks/features/useCenterTools.js';
import { useVKApi } from '@/popup/hooks/core/useVKApi.js';
import { downloadText } from '@/shared/utils/download.js';
import { CommunitiesIcon, SearchIcon, RefreshIcon, ExternalLinkIcon, DownloadIcon, ActivityIcon, WarningIcon } from '@/popup/components/icons/Icons.js';
import type { ToolGroup } from '@/shared/center-tools.js';
import BulkActions from '../BulkActions.js';
import '../CenterTools.css';

export default function SubscriptionsPage(): React.ReactElement {
  const { t, i18n } = useTranslation('center');
  const api = useVKApi(), data = useSubscriptions(api.userId);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
  const [days, setDays] = useState(90), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [mutating, setMutating] = useState(false);
  useEffect(() => { setSelected([]); }, [api.userId]);
  const locked = data.busy || mutating;
  const tr = (key: string) => t('subscriptions.' + key);
  // Reclassify known timestamps immediately when the threshold changes.
  const groups = useMemo(() => data.groups.map(g => g.lastPost !== null ? { ...g, activity: Date.now() - g.lastPost > days * 86400000 ? 'inactive' as const : 'active' as const } : g), [data.groups, days]);
  const filtered = groups.filter(g => (filter === 'all' || g.activity === filter || filter === 'closed' && g.closed)
    && g.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  const visible = filtered.slice(safePage * 20, safePage * 20 + 20);
  const chosen = groups.filter(g => selected.includes(g.id));
  const toggle = (id: number) => setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  const exportList = () => {
    const rows = chosen.length ? chosen : filtered;
    const cell = (value: string | number) => '"' + String(value).replace(/^[\s]*[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    downloadText(['id,name,status,last_post,url', ...rows.map(g => [g.id, g.title, tr('status.' + g.activity), g.lastPost ? new Date(g.lastPost).toISOString() : '', `https://vk.ru/club${g.id}`].map(cell).join(','))].join('\r\n'), 'vkify-subscriptions.csv', 'text/csv');
  };
  const summary: { key: string; count: number }[] = [
    { key: 'all', count: groups.length }, { key: 'inactive', count: groups.filter(g => g.activity === 'inactive').length },
    { key: 'unavailable', count: groups.filter(g => g.activity === 'unavailable').length },
  ];
  return <div className="center-tool" data-vkify-anchor="subscriptions-overview">
    <section className="ct-panel ct-overview">
      <div className="ct-heading"><div className="ct-heading-identity"><span className="ct-icon-tile"><CommunitiesIcon /></span><div><span className="ct-eyebrow">{t('tools.api_label')}</span><h3>{tr('title')}</h3><p>{tr('hint')}</p></div></div>
        <button className="ct-button" disabled={api.loading || !api.hasToken || locked} onClick={() => { setSelected([]); setPage(0); void data.load(true); }}><RefreshIcon />{tr(data.total === null ? 'load' : 'refresh')}</button></div>
      {!api.loading && !api.hasToken && <p role="status" className="ct-error">{t('tools.auth')}</p>}
      <div className="ct-summary">{summary.map(item => {
        const Icon = item.key === 'all' ? CommunitiesIcon : item.key === 'inactive' ? ActivityIcon : WarningIcon;
        return <button key={item.key} aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setPage(0); }}><Icon /><strong>{item.count.toLocaleString(i18n.resolvedLanguage)}</strong>{tr('filters.' + item.key)}</button>;
      })}</div>
      <div className="ct-toolbar"><label>{tr('threshold')}<select value={days} disabled={locked} onChange={e => setDays(Number(e.target.value))}>{[30, 90, 180, 365].map(n => <option key={n} value={n}>{t('subscriptions.days', { count: n })}</option>)}</select></label>
        <button className="ct-button ct-button--primary" disabled={locked || !api.hasToken || !groups.some(g => !g.deactivated)} onClick={() => void data.analyze(days)}><ActivityIcon />{tr('analyze')}</button>
        {data.more && <button className="ct-button" disabled={locked || !api.isReady} onClick={() => void data.load(false, true)}>{t('bulk.load_all')}</button>}
        {chosen.length > 0 && <button className="ct-button" disabled={locked || !api.isReady} onClick={() => void data.analyze(days, chosen.map(g => g.id))}>{t('bulk.analyze_selected')}</button>}
        {data.more && data.total !== null && <button className="ct-button" disabled={locked} onClick={() => void data.load()}>{tr('more')}</button>}
      </div>
      <p className="ct-note mt-3">{t('subscriptions.coverage', { count: groups.length, total: data.total ?? '—' })}</p>
      <details className="ct-explanation"><summary>{tr('how_checked')}</summary><p>{tr('method_note')}</p></details>
      {data.busy && <div className="ct-progress" role="status"><span>{data.progress.total ? `${data.progress.done} / ${data.progress.total}` : t('tools.loading')}</span>
        {data.progress.total > 0 && <progress value={data.progress.done} max={data.progress.total} />}
        <button className="ct-button" onClick={data.cancel}>{t('tools.cancel')}</button></div>}
      {data.error && <p role="alert" className="ct-error mt-3">{t('tools.' + data.error)}</p>}
    </section>
    <section className="ct-panel">
      <div className="ct-heading"><h3>{tr('list')} · {filtered.length}</h3><button className="ct-button" disabled={!filtered.length && !chosen.length} onClick={exportList}><DownloadIcon />{tr(chosen.length ? 'export_selected' : 'export')}</button></div>
      <div className="ct-toolbar"><div className="ct-search"><SearchIcon /><input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} aria-label={tr('search')} placeholder={tr('search')} /></div>
        <select value={filter} aria-label={tr('filter')} onChange={e => { setFilter(e.target.value); setPage(0); }}>{['all', 'active', 'inactive', 'empty', 'unavailable', 'unchecked', 'closed', 'error'].map(key => <option value={key} key={key}>{tr('filters.' + key)}</option>)}</select></div>
      <div className="ct-toolbar mt-3"><button className="ct-button" disabled={locked || !filtered.length} onClick={() => setSelected(filtered.map(g => g.id))}>{t('bulk.select_filtered', { count: filtered.length })}</button></div>
      <BulkActions ownerId={api.userId} actions={[{ key: 'unsubscribe', jobs: chosen.map(g => ({ id: String(g.id), title: g.title, method: 'groups.leave', params: { group_id: g.id } })) }]} disabled={data.busy || !api.isReady} onBusyChange={setMutating} onSuccess={job => { data.removeGroup(Number(job.id)); setSelected(old => old.filter(id => String(id) !== job.id)); }} />
      {chosen.length > 0 && <div className="ct-toolbar mt-3"><span className="ct-note">{t('subscriptions.selected', { count: chosen.length })}</span><button className="ct-button" disabled={locked} onClick={() => setSelected([])}>{tr('clear_selection')}</button></div>}
      <ul className="ct-list">{visible.map(group => <GroupRow key={group.id} group={group} checked={selected.includes(group.id)} disabled={locked} toggle={() => toggle(group.id)} />)}</ul>
      {!visible.length && <p className="ct-empty">{tr(data.total === null ? 'load_hint' : 'empty')}</p>}
      {filtered.length > 20 && <div className="ct-toolbar"><button className="ct-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t('stats.previous')}</button><span className="ct-note">{safePage + 1} / {Math.ceil(filtered.length / 20)}</span><button className="ct-button" disabled={(safePage + 1) * 20 >= filtered.length} onClick={() => setPage(safePage + 1)}>{t('stats.next')}</button></div>}
      <p className="ct-note">{tr('manual_note')}</p>
    </section>
  </div>;
}
function GroupRow({ group, checked, disabled, toggle }: { group: ToolGroup; checked: boolean; disabled: boolean; toggle: () => void }) {
  const { t, i18n } = useTranslation('center');
  const [broken, setBroken] = useState(false);
  return <li className="ct-group"><input type="checkbox" disabled={disabled} checked={checked} onChange={toggle} aria-label={t('subscriptions.select', { title: group.title })} />
    <span className="ct-avatar">{group.avatar && !broken ? <img src={group.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <CommunitiesIcon />}</span>
    <div className="ct-group-copy"><strong>{group.title}</strong><small>{group.members !== null && t('subscriptions.members', { count: group.members })}{group.closed ? ' · ' + t('subscriptions.closed') : ''}
      {group.lastPost !== null ? ' · ' + new Date(group.lastPost).toLocaleDateString(i18n.resolvedLanguage) : ''}</small></div>
    <span className={'ct-status ct-status--' + group.activity}>{t('subscriptions.status.' + group.activity)}</span>
    <a className="ct-button" href={`https://vk.ru/club${group.id}`} target="_blank" rel="noopener noreferrer" aria-label={t('subscriptions.open', { title: group.title })}><ExternalLinkIcon /></a>
  </li>;
}
