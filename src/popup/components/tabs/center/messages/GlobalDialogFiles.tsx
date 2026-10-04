import { Input, Select } from '@/popup/components/ui/FormControls.js';
import InfoDisclosure from '@/popup/components/ui/InfoDisclosure.js';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MEDIA_TYPES } from '@/shared/center-tools.js';
import { useGlobalDialogFiles } from '@/popup/hooks/features/useCenterTools.js';
import { fileIcons } from './FileGallery.js';
import FileTools from './FileTools.js';
import { AttachIcon, MessengerIcon, SearchIcon, RefreshIcon, PlayIcon, MessageIcon, LayoutRowsIcon } from '@/popup/components/icons/Icons.js';

export default function GlobalDialogFiles({ ownerId, ready, active }: { ownerId: string | null; ready: boolean; active: boolean }) {
  const { t } = useTranslation('center');
  const data = useGlobalDialogFiles(ownerId);
  const { cancel } = data;
  useEffect(() => { if (!active) cancel(); }, [active, cancel]);
  const [type, setType] = useState('all'), [dialog, setDialog] = useState('all');
  const [search, setSearch] = useState(''), [page, setPage] = useState(0);
  const [sort, setSort] = useState('newest');
  const files = useMemo(() => data.files.filter(f => (type === 'all' || f.type === type) && (dialog === 'all' || String(f.peerId) === dialog)
    && `${f.title} ${f.dialogTitle} ${f.url ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === 'oldest' ? a.date - b.date : b.date - a.date), [data.files, type, dialog, search, sort]);
  const safePage = Math.min(page, Math.max(0, Math.ceil(files.length / 36) - 1));
  const tr = (key: string) => t('files.' + key);
  return <>
    <section className="ct-panel ct-overview">
      <div className="ct-heading"><div className="ct-heading-identity"><span className="ct-icon-tile"><AttachIcon /></span><div><span className="ct-eyebrow">{t('tools.api_label')}</span><h3>{tr('library')}</h3><p>{tr('global_hint')}</p></div></div>
        <button className="ct-button" disabled={!ready || data.busy} onClick={() => { setPage(0); void data.load(true); }} aria-label={tr('refresh')} title={tr('refresh')}><RefreshIcon /></button></div>
      <div className="ct-summary ct-library-summary">
        <div><MessengerIcon /><strong>{data.dialogs.length}</strong><span>{tr('dialog_count')}</span></div>
        <div><AttachIcon /><strong>{data.files.length}</strong><span>{tr('file_count')}</span></div>
        <div><span className="ct-coverage-value">{data.covered.length}<small> / {data.dialogs.length}</small></span><span>{tr('coverage_label')}</span></div>
      </div>
      <div className="ct-toolbar">
        <button className="ct-button ct-button--primary" disabled={!ready || data.busy || data.phase === 'ready' && !data.pending}
          onClick={() => void data.load()}><PlayIcon />{tr(data.phase === 'idle' ? 'start_overview' : data.phase === 'ready' ? 'older_files' : 'resume')}</button>
        {data.busy && <button className="ct-button" onClick={data.cancel}>{t('tools.cancel')}</button>}
        {data.skipped.length > 0 && <span className="ct-note">{t('files.skipped', { count: data.skipped.length })}</span>}
      </div>
      {data.busy && <div className="ct-progress" role="status" aria-live="polite"><span>{tr(data.phase === 'dialogs' ? 'discovering' : 'collecting')} · {data.progress.done} / {data.progress.total || '…'}</span>
        <progress value={data.progress.done} max={Math.max(1, data.progress.total)} /></div>}
      <InfoDisclosure title={tr('how_collected')}><p>{tr('global_note')}</p></InfoDisclosure>
      {data.error && <p className="ct-error mt-3" role="alert">{t('tools.' + data.error)}</p>}
    </section>
    <section className="ct-panel">
      <div className="ct-heading"><h3>{tr('library_results')} <span className="ct-count">{files.length}</span></h3><span className="ct-note">{tr('search_hint')}</span></div>
      <div className="ct-tabs" role="group" aria-label={tr('type')}>
        <button aria-pressed={type === 'all'} onClick={() => { setType('all'); setPage(0); }}><AttachIcon />{tr('all_types')}</button>
        {MEDIA_TYPES.map(key => { const Icon = fileIcons[key]; return <button key={key} aria-pressed={type === key} onClick={() => { setType(key); setPage(0); }}><Icon />{tr('types.' + key)}</button>; })}
      </div>
      <div className="ct-toolbar"><div className="ct-search"><SearchIcon /><Input className="w-full pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} aria-label={tr('global_search')} placeholder={tr('global_search')} /></div>
        <Select icon={<MessageIcon />} aria-label={tr('dialog_filter')} value={dialog} onChange={e => { setDialog(e.target.value); setPage(0); }}><option value="all">{tr('all_dialogs')}</option>{data.dialogs.map(d => <option value={d.id} key={d.id}>{d.title}</option>)}</Select>
        <Select icon={<LayoutRowsIcon />} aria-label={tr('sort')} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="newest">{tr('newest')}</option><option value="oldest">{tr('oldest')}</option></Select></div>
      <FileTools ownerId={ownerId} scope={String(active)} disabled={data.busy || !ready || !active} files={files} visible={files.slice(safePage * 36, safePage * 36 + 36)} onDialog={id => { setDialog(String(id)); setPage(0); }} />
      {!files.length && <p className="ct-empty">{tr(data.phase === 'idle' ? 'global_empty' : data.busy ? 'collecting' : 'empty')}</p>}
      {files.length > 36 && <div className="ct-pagination"><button className="ct-button" disabled={!safePage} onClick={() => setPage(safePage - 1)}>{t('stats.previous')}</button><span>{safePage + 1} / {Math.ceil(files.length / 36)}</span><button className="ct-button" disabled={(safePage + 1) * 36 >= files.length} onClick={() => setPage(safePage + 1)}>{t('stats.next')}</button></div>}
    </section>
  </>;
}
