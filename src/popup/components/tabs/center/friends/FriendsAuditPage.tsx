import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FriendsIcon, StatisticsIcon, RefreshIcon, SearchIcon, ClockIcon, ImageIcon, XIcon, ArrowUpIcon, MessengerIcon, ExternalLinkIcon } from '@/popup/components/icons/Icons.js';
import { useVKApi } from '@/popup/hooks/core/useVKApi.js';
import { useFriendsAudit } from '@/popup/hooks/features/useFriendsAudit.js';
import { auditFriend, summarizeFriends, type AuditSection, type FriendFilter } from '@/shared/friends-audit.js';
import { activityBucket, ACTIVITY_BUCKETS, type ActivityBucket } from './friendsView.js';
import '../messages/messages-stats.css';
import './friends-audit.css';

const METRICS = [
  { key: 'total', icon: FriendsIcon, tone: 'blue', filter: 'all' },
  { key: 'inactive', icon: ClockIcon, tone: 'warm', filter: 'inactive' },
  { key: 'noAvatar', icon: ImageIcon, tone: 'violet', filter: 'noAvatar' },
  { key: 'deactivated', icon: XIcon, tone: 'warm', filter: 'deactivated' },
  { key: 'incoming', icon: MessengerIcon, tone: 'blue', filter: 'all' },
  { key: 'outgoing', icon: ArrowUpIcon, tone: 'green', filter: 'all' },
  { key: 'hiddenLastSeen', icon: ClockIcon, tone: 'violet', filter: 'hiddenLastSeen' },
] as const;

export default function FriendsAuditPage(): React.ReactElement {
  const { t, i18n } = useTranslation('center');
  const api = useVKApi();
  const { snapshot, loading, error, cacheFailed, progress, refresh } = useFriendsAudit(api.userId, api.isReady);
  const [days, setDays] = useState(180);
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [section, setSection] = useState<AuditSection>('friends');
  const [filter, setFilter] = useState<FriendFilter>('all');
  const [age, setAge] = useState<ActivityBucket | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('lastSeen');
  const [compact, setCompact] = useState(false);
  const [page, setPage] = useState(0);
  const friends = useMemo(() => (snapshot?.friends ?? []).map(user => auditFriend(user, days)), [snapshot, days]);
  const summary = snapshot ? summarizeFriends(friends, snapshot) : null;
  const buckets = ACTIVITY_BUCKETS.map(key => ({ key, count: friends.filter(user => activityBucket(user) === key).length }));
  const maxBucket = Math.max(1, ...buckets.map(bucket => bucket.count));
  const items = useMemo(() => {
    const source = section === 'friends' ? friends : (snapshot?.[section] ?? []).map(user => auditFriend(user, days));
    return source.filter(user => (section !== 'friends' || (filter === 'all' || Boolean(user[filter]) || filter === 'inactive' && includeUnknown && user.hiddenLastSeen) && (!age || activityBucket(user) === age))
      && user.name.toLocaleLowerCase(i18n.language).includes(search.trim().toLocaleLowerCase(i18n.language)))
      .sort((a, b) => (sort === 'unknown' ? Number(b.hiddenLastSeen) - Number(a.hiddenLastSeen) : sort === 'name' ? 0 : (a.online ? Infinity : a.lastSeen ?? Infinity) - (b.online ? Infinity : b.lastSeen ?? Infinity))
        || a.name.localeCompare(b.name, i18n.language));
  }, [friends, snapshot, section, days, includeUnknown, filter, age, search, sort, i18n.language]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(items.length / 50) - 1));
  const date = (value: number): string => new Date(value).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const number = (value: number): string => value.toLocaleString(i18n.language);
  const hasFilters = Boolean(search.trim() || section === 'friends' && (filter !== 'all' || age));
  const reset = () => { setFilter('all'); setAge(null); setSearch(''); setPage(0); };
  const running = loading || api.loading;
  return <div className="dialog-stats friends-audit" data-vkify-anchor="friends_audit">
    <section className="ds-overview" aria-label={t('friends.overview')}>
      <div className="ds-overview-head">
        <div className="ds-heading"><span className="ds-icon-tile"><StatisticsIcon /></span>
          <div><h3>{t('friends.overview')}</h3><p>{t('friends.overview_hint')}</p></div>
        </div>
        <button type="button" className="ds-button ds-icon-button" aria-label={t('friends.refresh')} title={t('friends.refresh')}
          disabled={running || !api.isReady} onClick={() => void refresh()}><RefreshIcon /></button>
      </div>
      <div className="ds-summary fa-summary">
        {METRICS.map(({ key, icon: Icon, tone, filter: nextFilter }) => {
          const target: AuditSection = key === 'incoming' || key === 'outgoing' ? key : 'friends';
          const value = summary?.[key];
          return <button type="button" key={key} className={'ds-metric ds-tone-' + tone + (key === 'hiddenLastSeen' ? ' fa-unknown-card' : '')} disabled={!snapshot}
            aria-pressed={section === target && filter === nextFilter && !age}
            onClick={() => { setSection(target); setFilter(nextFilter); setAge(null); setSearch(''); setPage(0); }}>
            <span className="ds-metric-top"><Icon /><span>{target === 'friends' && summary && summary.total > 0 ? Math.round((value ?? 0) / summary.total * 100) + '%' : '—'}</span></span>
            <strong>{value == null ? '—' : number(value)}</strong><span>{t(`friends.${key}`)}</span>
          </button>;
        })}
      </div>
      <div className="ds-freshness"><span className="ds-dot" />{snapshot ? t('friends.updated', { date: date(snapshot.fetchedAt) }) : t(running ? 'friends.loading' : 'friends.no_snapshot')}
        <span className="ds-freshness-end">{t('friends.read_only')}</span></div>
      {summary && <p className="fa-hint">{t('friends.coverage', { known: summary.total - summary.hiddenLastSeen, total: summary.total })}</p>}
    </section>

    {snapshot && <section className="ds-panel ds-activity" aria-label={t('friends.activity_title')}>
      <div className="ds-section-heading"><h3>{t('friends.activity_title')}</h3><span>{t('friends.activity_hint')}</span></div>
      <div className="ds-histogram">{buckets.map(({ key, count }) => <button type="button" key={key}
        className={`ds-bucket fa-bucket-${key}`} aria-pressed={section === 'friends' && age === key}
        onClick={() => { setSection('friends'); setAge(age === key ? null : key); setFilter('all'); setSearch(''); setPage(0); }}>
        <span className="ds-bar-count">{number(count)}</span>
        <span className="ds-bar-track"><span className="ds-bar" style={{ height: (count ? Math.max(6, count / maxBucket * 100) : 0) + '%' }} /></span>
        <span className="ds-bucket-label">{t(`friends.buckets.${key}`)}</span>
      </button>)}</div>
    </section>}

    <section className="ds-panel ds-controls" aria-label={t('friends.audit_settings')}>
      <div className="ds-control-row"><div className="fa-control-title"><ClockIcon /><strong>{t('friends.audit_settings')}</strong></div>
        <label className="ds-threshold"><span>{t('friends.threshold')}</span>
          <select value={days} onChange={e => { setDays(Number(e.target.value)); setPage(0); }}>
            {[90, 180, 365].map(value => <option key={value} value={value}>{t('friends.days', { count: value })}</option>)}
          </select>
        </label>
      </div>
      <label className="fa-known"><input type="checkbox" checked={includeUnknown} onChange={e => { setIncludeUnknown(e.target.checked); setPage(0); }} />{t('friends.include_unknown')}</label>
      <p className="fa-hint">{t('friends.unknown_hint')}</p>
      <details className="ds-explanation"><summary>{t('friends.how_counted')}</summary><p>{t('friends.description')}</p><p>{t('friends.unknown_hint')}</p></details>
      {!api.loading && !api.isReady && <p role="status" className="fa-hint">{t('friends.auth')}</p>}
      {running && <div className="ds-progress" role="status" aria-live="polite">
        <div><span>{progress ? t(progress.phase === 'activity' ? 'friends.activity_progress' : 'friends.progress', { section: t(`friends.${progress.section}`), loaded: progress.loaded, total: progress.total }) : t('friends.loading')}</span></div>
        <progress aria-label={t('friends.loading')} value={progress ? progress.loaded : undefined} max={Math.max(progress?.total ?? 1, 1)} />
      </div>}
      {error && <p role="alert" className="ds-error">{t('friends.error')} {error}</p>}
      {snapshot?.enrichmentFailed && <p role="status" className="fa-hint">{t('friends.enrichment_failed')}</p>}
      {snapshot?.requestErrors && <p role="status" className="fa-hint">{t('friends.requests_failed')}</p>}
      {cacheFailed && <p role="status" className="fa-hint">{t('friends.cache_failed')}</p>}
    </section>

    {snapshot && <section className="ds-results" aria-label={t('friends.profiles')}>
      <div className="ds-section-heading"><h3>{t('friends.profiles')} <span className="ds-result-count">{number(items.length)}</span></h3></div>
      <div className="ds-mode fa-segments" role="group" aria-label={t('friends.profiles')}>
        {(['friends', 'incoming', 'outgoing'] as const).map(value => <button key={value} type="button" aria-pressed={section === value}
          onClick={() => { setSection(value); reset(); }}>{t(`friends.${value}`)}<span className="fa-segment-count">{value !== 'friends' && snapshot.requestErrors?.[value] ? '—' : number(snapshot[value].length)}</span></button>)}
      </div>
      <div className="ds-search"><SearchIcon /><input type="search" aria-label={t('friends.search')} placeholder={t('friends.search')} value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }} />
        {search && <button type="button" aria-label={t('friends.clear_search')} onClick={() => { setSearch(''); setPage(0); }}><XIcon /></button>}
      </div>
      <div className="ds-filter-row">
        {section === 'friends' && <select aria-label={t('friends.filter')} value={filter} onChange={e => { setFilter(e.target.value as FriendFilter); setPage(0); }}>
          {(['all', 'inactive', 'noAvatar', 'deactivated', 'hiddenLastSeen'] as const).map(value => <option key={value} value={value}>{t(`friends.${value}`)}</option>)}
        </select>}
        <select aria-label={t('friends.sort')} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}>
          <option value="lastSeen">{t('friends.sort_seen')}</option><option value="name">{t('friends.sort_name')}</option><option value="unknown">{t('friends.sort_unknown')}</option>
        </select>
      </div>
      <div className="ds-list-options"><label><input type="checkbox" checked={compact} onChange={e => setCompact(e.target.checked)} />{t('friends.compact')}</label>
        {hasFilters && <button type="button" onClick={reset}>{t('friends.reset_filters')}</button>}
      </div>
      {section === 'friends' && age && <button type="button" className="ds-active-filter" onClick={() => { setAge(null); setPage(0); }}>{t(`friends.buckets.${age}`)}<XIcon /></button>}
      <ul className="ds-list" aria-label={t(`friends.${section}`)}>
        {items.slice(currentPage * 50, (currentPage + 1) * 50).map(user => <li key={user.id} className={`ds-dialog fa-profile${compact ? ' is-compact' : ''}`}>
          <div className="ds-dialog-head">
            <a href={`https://vk.ru/id${user.id}`} target="_blank" rel="noopener noreferrer" className="fa-identity">
              <span className="fa-avatar">{user.photo && !user.noAvatar ? <img src={user.photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <FriendsIcon />}
                {user.online && <span className="fa-online" aria-hidden="true" />}</span>
              <span className="fa-name"><strong>{user.name}</strong><span>{user.online ? t('friends.online') : user.lastSeen ? t('friends.last_seen', { date: date(user.lastSeen * 1000) }) : user.approximateStatus ? t(`friends.approximate.${user.approximateStatus}`) : t(user.activityHidden ? 'friends.activity_hidden' : 'friends.unknown')}</span></span>
              <ExternalLinkIcon className="fa-open" />
            </a>
          </div>
          <div className="fa-profile-meta">
            {([user.inactive && 'inactive', user.noAvatar && 'noAvatar', user.deactivated, user.hiddenLastSeen && 'hiddenLastSeen'].filter(Boolean) as string[]).map(badge => <span key={badge} className={`ds-badge ${badge === 'inactive' || badge === 'deleted' || badge === 'banned' ? 'ds-badge-warm' : ''}`}><span className="ds-dot" />{t(`friends.${badge}`)}</span>)}
            {!compact && <span className="fa-id">ID {user.id}</span>}
          </div>
        </li>)}
      </ul>
      {section !== 'friends' && snapshot.requestErrors?.[section] ? <div className="ds-empty" role="status"><h3>{t('friends.requests_unavailable')}</h3><p>{t('friends.requests_failed')}</p></div> : !items.length && <div className="ds-empty"><SearchIcon /><h3>{t('friends.empty')}</h3><p>{t(hasFilters ? 'friends.empty_filters' : 'friends.empty_hint')}</p>
        {hasFilters && <button type="button" className="ds-button" onClick={reset}>{t('friends.reset_filters')}</button>}</div>}
      {items.length > 50 && <div className="ds-pagination">
        <button type="button" className="ds-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('friends.previous')}</button>
        <span>{currentPage + 1} / {Math.ceil(items.length / 50)}</span>
        <button type="button" className="ds-button" disabled={(currentPage + 1) * 50 >= items.length} onClick={() => setPage(currentPage + 1)}>{t('friends.next')}</button>
      </div>}
    </section>}
  </div>;
}
