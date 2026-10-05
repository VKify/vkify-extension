import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/popup/components/ui/FormControls.js';
import Checkbox from '@/popup/components/ui/Checkbox.js';
import { useVKApi } from '@/popup/hooks/core/useVKApi.js';
import { useDocumentCatalog } from '@/popup/hooks/features/useDocumentCatalog.js';
import { FileTextIcon, SearchIcon, RefreshIcon, ExternalLinkIcon, LayoutRowsIcon, DatabaseIcon } from '@/popup/components/icons/Icons.js';
import { documentSize, documentFilename } from '@/shared/document-catalog.js';
import { downloadText } from '@/shared/utils/download.js';
import BulkActions from '../BulkActions.js';
import MediaUpload from '../MediaUpload.js';
import CatalogDownloads from '../CatalogDownloads.js';
import { CatalogSelection, CatalogPagination } from '../CatalogControls.js';
import '../CenterTools.css';
import './Documents.css';

export default function DocumentsPage() {
  const { t, i18n } = useTranslation('center'), auth = useVKApi(), data = useDocumentCatalog(auth.userId);
  const tr = (key: string) => t('document_catalog.' + key);
  const [search, setSearch] = useState(''), [type, setType] = useState('all'), [sort, setSort] = useState('saved'), [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]), [mutating, setMutating] = useState(false), [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => { setSelected([]); setPage(0); }, [auth.userId]);
  const locked = mutating || uploading || downloading || data.busy;
  const filtered = data.documents.filter(d => (!search || `${d.title} ${d.tags.join(' ')} ${d.extension}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    && (type === 'all' || d.type === Number(type)));
  if (sort !== 'saved') filtered.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, i18n.resolvedLanguage) : sort === 'size' ? b.size - a.size : b.date - a.date);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 24) - 1)), visible = filtered.slice(safePage * 24, safePage * 24 + 24);
  const listRef = useRef<HTMLDivElement>(null);
  const changePage = (next: number) => { setPage(next); requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };
  const chosen = data.documents.filter(d => selected.includes(d.key));
  const load = () => { setPage(0); void data.load(true); };
  return <div className="center-tool" data-vkify-anchor="document-catalog">
    <section className="ct-panel ct-overview">
      <div className="ct-heading"><div className="ct-heading-identity"><span className="ct-icon-tile"><FileTextIcon /></span><div><span className="ct-eyebrow">{t('tools.api_label')}</span><h3>{tr('title')}</h3><p>{tr('hint')}</p></div></div>
        <button className="ct-button" disabled={!auth.isReady || locked} onClick={load}><RefreshIcon />{tr(data.total === null ? 'load' : 'refresh')}</button></div>
      {!auth.loading && !auth.hasToken && <p role="status" className="ct-error">{t('tools.auth')}</p>}
      <div className="dc-summary"><span><FileTextIcon /><strong>{data.documents.length}</strong>{tr('loaded')}</span><span><DatabaseIcon /><strong>{documentSize(data.documents.reduce((sum, d) => sum + d.size, 0))}</strong>{tr('total_size')}</span></div>
      <p className="ct-note mt-3">{t('document_catalog.coverage', { count: data.documents.length, total: data.total ?? '—' })}</p>
      {data.error && <p role="alert" className="ct-error">{t('tools.' + data.error)}</p>}
      {data.busy && <div className="ct-progress" role="status">{t('tools.loading')}<button className="ct-button" onClick={data.cancel}>{t('tools.cancel')}</button></div>}
    </section>
    <MediaUpload kind="doc" ownerId={auth.userId} albums={[]} disabled={!auth.isReady || mutating || downloading || data.busy} onBusyChange={setUploading} onUploaded={load} />
    <section className="ct-panel">
      <div className="ct-heading"><h3>{tr('list')} · {filtered.length}</h3><span className="ct-note">{tr('search_note')}</span></div>
      <div className="ct-search"><SearchIcon /><Input className="w-full pl-9" aria-label={tr('search')} placeholder={tr('search')} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div>
      <div className="dc-filters">
        <Select className="w-full" icon={<FileTextIcon />} aria-label={tr('type')} value={type} onChange={e => { setType(e.target.value); setPage(0); }}><option value="all">{tr('all_types')}</option>{[1, 2, 3, 4, 5, 6, 7, 8].map(id => <option key={id} value={id}>{tr('types.' + id)}</option>)}</Select>
        <Select className="w-full" icon={<LayoutRowsIcon />} aria-label={tr('sort')} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}>{['saved', 'title', 'date', 'size'].map(k => <option key={k} value={k}>{tr('sorts.' + k)}</option>)}</Select>
      </div>
      <CatalogSelection keys={filtered.map(d => d.key)} pageKeys={visible.map(d => d.key)} selected={chosen.map(d => d.key)} disabled={locked} onChange={setSelected} />
      <div className="ct-toolbar ct-catalog-actions"><button className="ct-button" disabled={!filtered.length} onClick={() => downloadText(JSON.stringify(chosen.length ? chosen : filtered, null, 2), 'vkify-documents.json', 'application/json')}>{t('bulk.export_list')}</button></div>
      <CatalogDownloads kind="doc" ownerId={auth.userId} disabled={locked || !auth.isReady} onBusyChange={setDownloading} onSaved={keys => setSelected(old => old.filter(key => !keys.includes(key)))}
        items={chosen.map(d => ({ key: d.key, title: d.title || tr('untitled'), source: d.source, filename: documentFilename(d) }))} />
      <BulkActions ownerId={auth.userId} scope="documents" disabled={uploading || downloading || data.busy || !auth.isReady} onBusyChange={setMutating} actions={[
        { key: 'delete_documents', jobs: chosen.map(d => { const [owner, id] = d.key.split('_').map(Number); return { id: d.key, title: d.title || tr('untitled'), method: 'docs.delete', params: { owner_id: owner, doc_id: id } }; }) },
      ]} onSuccess={job => { if (job.method === 'docs.delete') data.removeDocument(job.id); setSelected(old => old.filter(id => id !== job.id)); }} />
      <CatalogPagination page={safePage} total={filtered.length} disabled={locked} onChange={changePage} />
      <div className="dc-list" ref={listRef}>{visible.map(d => <article className={`dc-document ${selected.includes(d.key) ? 'ct-card--selected' : ''}`} key={d.key}>
        <label className="dc-selection"><Checkbox checked={selected.includes(d.key)} disabled={locked} onChange={() => setSelected(old => old.includes(d.key) ? old.filter(id => id !== d.key) : [...old, d.key])} /><span className="sr-only">{t('bulk.select_item', { title: d.title || tr('untitled') })}</span></label>
        <a className="dc-document-icon" href={d.url} target="_blank" rel="noopener noreferrer" aria-label={d.title || tr('untitled')}><FileTextIcon />{d.preview && <img src={d.preview} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}</a>
        <div className="dc-document-body"><h4 title={d.title}>{d.title || tr('untitled')}</h4><div className="dc-meta"><span className="dc-extension">{d.extension || tr('types.' + d.type)}</span><span>{documentSize(d.size)}</span>{d.date > 0 && <time>{new Date(d.date).toLocaleDateString(i18n.resolvedLanguage)}</time>}</div>
          {!!d.tags.length && <div className="dc-tags">{d.tags.map((tag, index) => <span key={index}>{tag}</span>)}</div>}</div>
        <a className="dc-open" href={d.url} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon /><span>{tr('open')}</span></a>
      </article>)}</div>
      {!visible.length && !data.busy && <p className="ct-empty">{tr(data.total === null ? 'initial' : data.documents.length ? 'no_matches' : 'empty')}</p>}
      <CatalogPagination page={safePage} total={filtered.length} disabled={locked} onChange={changePage} />
      {data.more && <div className="ct-toolbar mt-4"><button className="ct-button" disabled={locked} onClick={() => void data.load(false, true)}>{t('bulk.load_all')}</button><button className="ct-button" disabled={locked} onClick={() => void data.load()}>{tr('more')}</button></div>}
    </section>
  </div>;
}
