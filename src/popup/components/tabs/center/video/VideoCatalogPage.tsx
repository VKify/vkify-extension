import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKApi } from '@/popup/hooks/core/useVKApi.js';
import { useVideoCatalog } from '@/popup/hooks/features/useVideoCatalog.js';
import { videoDuration } from '@/shared/video-catalog.js';
import { VideoIcon, SearchIcon, RefreshIcon, ExternalLinkIcon, WarningIcon, ClockIcon } from '@/popup/components/icons/Icons.js';
import '../CenterTools.css';
import './VideoCatalog.css';
import BulkActions from '../BulkActions.js';
import { downloadText } from '@/shared/utils/download.js';

export default function VideoCatalogPage(): React.ReactElement {
  const { t, i18n } = useTranslation('center'), auth = useVKApi(), data = useVideoCatalog(auth.userId);
  const [search, setSearch] = useState(''), [duration, setDuration] = useState('all');
  const [status, setStatus] = useState('all'), [sort, setSort] = useState('saved'), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]), [mutating, setMutating] = useState(false);
  const [targetAlbum, setTargetAlbum] = useState('');
  useEffect(() => { setSelected([]); setTargetAlbum(''); }, [auth.userId, data.album]);
  const locked = mutating || data.videoTask.busy || data.albumTask.busy;
  const tr = (key: string) => t('video_catalog.' + key);
  const filtered = data.videos.filter(v => (!search || `${v.title} ${v.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    && (status === 'all' || (status === 'unavailable' ? v.unavailable : !v.unavailable))
    && (duration === 'all' || (duration === 'short' ? v.duration > 0 && v.duration < 600 : duration === 'medium' ? v.duration >= 600 && v.duration < 3600 : v.duration >= 3600)));
  if (sort !== 'saved') filtered.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, i18n.resolvedLanguage)
    : sort === 'duration' ? b.duration - a.duration : b.date - a.date);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 24) - 1)), visible = filtered.slice(safePage * 24, safePage * 24 + 24);
  const chosen = data.videos.filter(v => selected.includes(v.key));
  const jobs = (method: string) => chosen.filter(v => method !== 'video.delete' || Number(v.key.split('_')[0]) !== Number(auth.userId)).map(v => { const [owner, id] = v.key.split('_').map(Number); return { id: v.key, title: v.title || tr('untitled'), method, params: { owner_id: owner, video_id: id, target_id: Number(auth.userId), ...(method === 'video.addToAlbum' ? { album_id: Number(targetAlbum) } : {}) } }; });
  const load = () => { setPage(0); void data.loadVideos(true); void data.loadAlbums(true); };
  return <div className="center-tool" data-vkify-anchor="video-catalog">
    <section className="ct-panel ct-overview">
      <div className="ct-heading"><div className="ct-heading-identity"><span className="ct-icon-tile"><VideoIcon /></span><div><span className="ct-eyebrow">{t('tools.api_label')}</span><h3>{tr('title')}</h3><p>{tr('hint')}</p></div></div>
        <button className="ct-button" disabled={!auth.hasToken || auth.loading || locked} onClick={load}><RefreshIcon />{tr(data.total === null ? 'load' : 'refresh')}</button></div>
      {!auth.loading && !auth.hasToken && <p role="status" className="ct-error">{t('tools.auth')}</p>}
      <div className="ct-summary">
        <button aria-pressed={status === 'all'} onClick={() => { setStatus('all'); setPage(0); }}><VideoIcon /><strong>{data.videos.length}</strong>{tr('loaded')}</button>
        <button aria-pressed={status === 'unavailable'} onClick={() => { setStatus('unavailable'); setPage(0); }}><WarningIcon /><strong>{data.videos.filter(v => v.unavailable).length}</strong>{tr('unavailable')}</button>
        <div className="vc-metric"><ClockIcon /><strong>{videoDuration(data.videos.reduce((sum, v) => sum + v.duration, 0))}</strong>{tr('total_duration')}</div>
      </div>
      <p className="ct-note mt-3">{t('video_catalog.coverage', { count: data.videos.length, total: data.total ?? '—' })}</p>
      {data.videoTask.error && <p role="alert" className="ct-error">{t('tools.' + data.videoTask.error)}</p>}
      {data.videoTask.busy && <div className="ct-progress" role="status">{t('tools.loading')}<button className="ct-button" onClick={data.videoTask.cancel}>{t('tools.cancel')}</button></div>}
    </section>
    <section className="ct-panel">
      <div className="ct-heading"><h3>{tr('list')} · {filtered.length}</h3><span className="ct-note">{tr('search_note')}</span></div>
      <div className="ct-search"><SearchIcon /><input aria-label={tr('search')} placeholder={tr('search')} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
      <div className="ct-toolbar vc-filters">
        <select aria-label={tr('album')} value={data.album ?? 'all'} disabled={!auth.hasToken || locked} onChange={e => { setPage(0); data.chooseAlbum(e.target.value === 'all' ? null : Number(e.target.value)); }}><option value="all">{tr('all_albums')}</option>{data.albums.map(a => <option key={a.id} value={a.id}>{a.title || tr('untitled')} · {a.count}</option>)}</select>
        <select aria-label={tr('duration')} value={duration} onChange={e => { setDuration(e.target.value); setPage(0); }}>{['all', 'short', 'medium', 'long'].map(k => <option key={k} value={k}>{tr('durations.' + k)}</option>)}</select>
        <select aria-label={tr('status')} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>{['all', 'available', 'unavailable'].map(k => <option key={k} value={k}>{tr('statuses.' + k)}</option>)}</select>
        <select aria-label={tr('sort')} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}>{['saved', 'title', 'date', 'duration'].map(k => <option key={k} value={k}>{tr('sorts.' + k)}</option>)}</select>
      </div>
      {data.albumTask.error && <div role="alert" className="ct-toolbar ct-error">{tr('albums_error')}<button className="ct-button" disabled={locked} onClick={() => void data.loadAlbums(true)}>{tr('retry_albums')}</button></div>}
      {data.moreAlbums && <button className="ct-button mt-3" disabled={locked} onClick={() => void data.loadAlbums()}>{tr('more_albums')}</button>}
      <div className="ct-toolbar mt-3"><button className="ct-button" disabled={locked || !filtered.length} onClick={() => setSelected(filtered.map(v => v.key))}>{t('bulk.select_filtered', { count: filtered.length })}</button><button className="ct-button" disabled={locked || !selected.length} onClick={() => setSelected([])}>{t('bulk.clear')}</button><button className="ct-button" disabled={!filtered.length} onClick={() => downloadText(JSON.stringify(chosen.length ? chosen : filtered, null, 2), 'vkify-videos.json', 'application/json')}>{t('bulk.export_list')}</button>
        <label>{t('bulk.target_album')}<select value={targetAlbum} disabled={locked} onChange={e => setTargetAlbum(e.target.value)}><option value="">{t('bulk.choose_album')}</option>{data.albums.filter(a => a.id > 0).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label></div>
      <BulkActions ownerId={auth.userId} scope={String(data.album)} disabled={data.videoTask.busy || data.albumTask.busy || !auth.isReady} onBusyChange={setMutating} actions={[{ key: 'delete_videos', jobs: jobs('video.delete') }, { key: 'add_to_album', jobs: targetAlbum ? jobs('video.addToAlbum') : [] }]} onSuccess={job => { if (job.method === 'video.delete') data.removeVideo(job.id); setSelected(old => old.filter(id => id !== job.id)); }} />
      <div className="vc-grid">{visible.map(v => <article className={`vc-video ${v.unavailable ? 'vc-video--unavailable' : ''}`} key={v.key}>
        <a className="vc-preview" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={v.title || tr('untitled')}>
          <VideoIcon />{v.preview && <img src={v.preview} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
          {v.duration > 0 && <span className="vc-duration">{videoDuration(v.duration)}</span>}
        </a><div className="vc-video-body"><label className="ct-item-selection"><input type="checkbox" checked={selected.includes(v.key)} disabled={locked} onChange={() => setSelected(old => old.includes(v.key) ? old.filter(id => id !== v.key) : [...old, v.key])} />{t('bulk.select_item', { title: v.title || tr('untitled') })}</label><h4 title={v.title}>{v.title || tr('untitled')}</h4>
          <div className="vc-meta">{v.date > 0 && <time>{new Date(v.date).toLocaleDateString(i18n.resolvedLanguage)}</time>}{v.views !== null && <span>{t('video_catalog.views', { count: v.views })}</span>}</div>
          {v.unavailable && <p className="vc-restriction"><WarningIcon />{v.restriction || tr('unavailable')}</p>}
          <a className="vc-open" href={v.url} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon />{tr('open')}</a>
        </div>
      </article>)}</div>
      {!visible.length && !data.videoTask.busy && <p className="ct-empty">{tr(data.total === null ? 'initial' : data.videos.length ? 'no_matches' : 'empty')}</p>}
      {filtered.length > 24 && <div className="ct-pagination"><button className="ct-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t('tools.previous')}</button><span>{safePage + 1} / {Math.ceil(filtered.length / 24)}</span><button className="ct-button" disabled={(safePage + 1) * 24 >= filtered.length} onClick={() => setPage(safePage + 1)}>{t('tools.next')}</button></div>}
      {data.more && <button className="ct-button mt-4" disabled={locked} onClick={() => void data.loadVideos(false, data.album, true)}>{t('bulk.load_all')}</button>}
      {data.more && <button className="ct-button mt-4" disabled={locked} onClick={() => void data.loadVideos()}>{tr('more')}</button>}
    </section>
  </div>;
}
