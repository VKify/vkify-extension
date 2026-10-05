import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/popup/components/ui/FormControls.js';
import Checkbox from '@/popup/components/ui/Checkbox.js';
import { useVKApi } from '@/popup/hooks/core/useVKApi.js';
import { usePhotoCatalog } from '@/popup/hooks/features/usePhotoCatalog.js';
import { PhotoAlbumIcon, SearchIcon, RefreshIcon, ExternalLinkIcon, LayoutRowsIcon } from '@/popup/components/icons/Icons.js';
import { downloadText } from '@/shared/utils/download.js';
import BulkActions from '../BulkActions.js';
import MediaUpload from '../MediaUpload.js';
import '../CenterTools.css';
import '../video/VideoCatalog.css';

export default function PhotoCatalogPage() {
  const { t, i18n } = useTranslation('center'), auth = useVKApi(), data = usePhotoCatalog(auth.userId);
  const tr = (key: string) => t('photo_catalog.' + key);
  const [search, setSearch] = useState(''), [sort, setSort] = useState('saved'), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]), [targetAlbum, setTargetAlbum] = useState('');
  const [mutating, setMutating] = useState(false), [uploading, setUploading] = useState(false);
  useEffect(() => { setSelected([]); setTargetAlbum(''); setPage(0); }, [auth.userId, data.album]);
  const locked = mutating || uploading || data.photoTask.busy || data.albumTask.busy;
  const filtered = data.photos.filter(p => !search || p.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  if (sort !== 'saved') filtered.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, i18n.resolvedLanguage) : b.date - a.date);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 24) - 1)), visible = filtered.slice(safePage * 24, safePage * 24 + 24);
  const chosen = data.photos.filter(p => selected.includes(p.key));
  const load = () => { setPage(0); void data.loadPhotos(true); void data.loadAlbums(true); };
  const jobs = (method: string) => chosen.filter(p => Number(p.key.split('_')[0]) === Number(auth.userId)).map(p => {
    const [owner, id] = p.key.split('_').map(Number);
    return { id: p.key, title: p.title || tr('untitled'), method, params: { owner_id: owner, photo_id: id,
      ...(method === 'photos.move' ? { target_album_id: Number(targetAlbum) } : {}) } };
  });
  return <div className="center-tool" data-vkify-anchor="photo-catalog">
    <section className="ct-panel ct-overview">
      <div className="ct-heading"><div className="ct-heading-identity"><span className="ct-icon-tile"><PhotoAlbumIcon /></span><div><span className="ct-eyebrow">{t('tools.api_label')}</span><h3>{tr('title')}</h3><p>{tr('hint')}</p></div></div>
        <button className="ct-button" disabled={!auth.isReady || locked} onClick={load}><RefreshIcon />{tr(data.total === null ? 'load' : 'refresh')}</button></div>
      {!auth.loading && !auth.hasToken && <p role="status" className="ct-error">{t('tools.auth')}</p>}
      <p className="ct-note mt-3">{t('photo_catalog.coverage', { count: data.photos.length, total: data.total ?? '—' })}</p>
      {data.photoTask.error && <p role="alert" className="ct-error">{t('tools.' + data.photoTask.error)}</p>}
      {data.photoTask.busy && <div className="ct-progress" role="status">{t('tools.loading')}<button className="ct-button" onClick={data.photoTask.cancel}>{t('tools.cancel')}</button></div>}
    </section>
    <MediaUpload kind="photo" ownerId={auth.userId} albums={data.albums} disabled={!auth.isReady || mutating || data.photoTask.busy || data.albumTask.busy} onBusyChange={setUploading} onUploaded={load} />
    <section className="ct-panel">
      <div className="ct-heading"><h3>{tr('list')} · {filtered.length}</h3><span className="ct-note">{tr('search_note')}</span></div>
      <div className="ct-search"><SearchIcon /><Input className="w-full pl-9" aria-label={tr('search')} placeholder={tr('search')} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
      <div className="ct-toolbar vc-filters">
        <Select icon={<PhotoAlbumIcon />} aria-label={tr('album')} value={data.album ?? 'all'} disabled={!auth.isReady || locked} onChange={e => { setPage(0); data.chooseAlbum(e.target.value === 'all' ? null : Number(e.target.value)); }}><option value="all">{tr('all_albums')}</option>{data.albums.map(a => <option key={a.id} value={a.id}>{a.title || tr('untitled')} · {a.count}</option>)}</Select>
        <Select icon={<LayoutRowsIcon />} aria-label={tr('sort')} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}>{['saved', 'title', 'date'].map(k => <option key={k} value={k}>{tr('sorts.' + k)}</option>)}</Select>
      </div>
      {data.albumTask.error && <div role="alert" className="ct-toolbar ct-error">{tr('albums_error')}<button className="ct-button" disabled={locked} onClick={() => void data.loadAlbums(true)}>{tr('retry_albums')}</button></div>}
      {data.moreAlbums && <button className="ct-button mt-3" disabled={locked} onClick={() => void data.loadAlbums()}>{tr('more_albums')}</button>}
      <div className="ct-toolbar mt-3"><button className="ct-button" disabled={locked || !filtered.length} onClick={() => setSelected(filtered.map(p => p.key))}>{t('bulk.select_filtered', { count: filtered.length })}</button><button className="ct-button" disabled={locked || !selected.length} onClick={() => setSelected([])}>{t('bulk.clear')}</button><button className="ct-button" disabled={!filtered.length} onClick={() => downloadText(JSON.stringify(chosen.length ? chosen : filtered, null, 2), 'vkify-photos.json', 'application/json')}>{t('bulk.export_list')}</button>
        <label>{t('bulk.target_album')}<Select icon={<PhotoAlbumIcon />} value={targetAlbum} disabled={locked} onChange={e => setTargetAlbum(e.target.value)}><option value="">{t('bulk.choose_album')}</option>{data.albums.filter(a => a.canUpload).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</Select></label></div>
      <BulkActions ownerId={auth.userId} scope={String(data.album)} disabled={uploading || data.photoTask.busy || data.albumTask.busy || !auth.isReady} onBusyChange={setMutating} actions={[
        { key: 'delete_photos', jobs: jobs('photos.delete') }, { key: 'move_photos', jobs: targetAlbum ? jobs('photos.move') : [] },
        { key: 'download_files', jobs: chosen.filter(p => p.source?.startsWith('https://')).map(p => ({ id: p.key, title: p.title || tr('untitled'), method: 'download.attachment', params: { url: p.source, filename: `vkify-photo-${p.key}.${new URL(p.source!).pathname.match(/\.(jpe?g|png|gif|webp)$/i)?.[1] || 'jpg'}` } })) },
      ]} onSuccess={job => {
        if (job.method === 'photos.delete' || (job.method === 'photos.move' && data.album !== null && Number(targetAlbum) !== data.album)) data.removePhoto(job.id);
        setSelected(old => old.filter(id => id !== job.id));
      }} />
      <div className="vc-grid">{visible.map(p => <article className="vc-video" key={p.key}>
        <a className="vc-preview" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={p.title || tr('untitled')}><PhotoAlbumIcon />{p.preview && <img src={p.preview} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}</a>
        <div className="vc-video-body"><label className="ct-item-selection"><Checkbox checked={selected.includes(p.key)} disabled={locked} onChange={() => setSelected(old => old.includes(p.key) ? old.filter(id => id !== p.key) : [...old, p.key])} />{t('bulk.select_item', { title: p.title || tr('untitled') })}</label><h4 title={p.title}>{p.title || tr('untitled')}</h4>
          <div className="vc-meta">{p.date > 0 && <time>{new Date(p.date).toLocaleDateString(i18n.resolvedLanguage)}</time>}{p.width > 0 && <span>{p.width} × {p.height}</span>}</div>
          <a className="vc-open" href={p.url} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon />{tr('open')}</a></div>
      </article>)}</div>
      {!visible.length && !data.photoTask.busy && <p className="ct-empty">{tr(data.total === null ? 'initial' : data.photos.length ? 'no_matches' : 'empty')}</p>}
      {filtered.length > 24 && <div className="ct-pagination"><button className="ct-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t('tools.previous')}</button><span>{safePage + 1} / {Math.ceil(filtered.length / 24)}</span><button className="ct-button" disabled={(safePage + 1) * 24 >= filtered.length} onClick={() => setPage(safePage + 1)}>{t('tools.next')}</button></div>}
      {data.more && <div className="ct-toolbar mt-4"><button className="ct-button" disabled={locked} onClick={() => void data.loadPhotos(false, data.album, true)}>{t('bulk.load_all')}</button><button className="ct-button" disabled={locked} onClick={() => void data.loadPhotos()}>{tr('more')}</button></div>}
    </section>
  </div>;
}
