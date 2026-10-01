import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDialogFiles } from '@/popup/hooks/features/useCenterTools.js';
import { useVKApi } from '@/popup/hooks/core/useVKApi.js';
import { MEDIA_TYPES, type MediaType } from '@/shared/center-tools.js';
import { UsersIcon, SearchIcon, RefreshIcon, AttachIcon, MessengerIcon } from '@/popup/components/icons/Icons.js';
import GlobalDialogFiles from './GlobalDialogFiles.js';
import { FileGallery, fileIcons } from './FileGallery.js';
import '../CenterTools.css';

export default function DialogFilesPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const api = useVKApi(), data = useDialogFiles(api.userId);
  const [scope, setScope] = useState<'all' | 'dialog'>('all');
  const { cancel: cancelFiles } = data.fileTask, { cancel: cancelDialogs } = data.dialogTask;
  useEffect(() => { if (scope === 'all') { cancelFiles(); cancelDialogs(); } }, [scope, cancelFiles, cancelDialogs]);
  const [dialogSearch, setDialogSearch] = useState(''), [search, setSearch] = useState('');
  const tr = (key: string) => t('files.' + key);
  const dialogs = data.dialogs.filter(d => d.title.toLocaleLowerCase().includes(dialogSearch.toLocaleLowerCase()));
  const files = data.files.filter(f => (f.title + ' ' + (f.url ?? '')).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const selected = data.dialogs.find(d => d.id === data.peer);
  return <div className="center-tool" data-vkify-anchor="dialog-files">
    <div className="ct-scope" role="group" aria-label={tr('scope')}>
      <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}><AttachIcon /><span>{tr('all_dialogs')}<small>{tr('all_scope_hint')}</small></span></button>
      <button aria-pressed={scope === 'dialog'} onClick={() => setScope('dialog')}><MessengerIcon /><span>{tr('one_dialog')}<small>{tr('one_scope_hint')}</small></span></button>
    </div>
    {!api.loading && !api.hasToken && <p className="ct-error" role="status">{t('tools.auth')}</p>}
    <div hidden={scope !== 'all'} className="ct-scope-content"><GlobalDialogFiles ownerId={api.userId} ready={api.isReady} active={scope === 'all'} /></div>
    <div hidden={scope !== 'dialog'} className="ct-scope-content">
    <section className="ct-panel">
      <div className="ct-heading"><div className="ct-heading-identity"><span className="ct-icon-tile"><MessengerIcon /></span><div><h3>{tr('choose')}</h3><p>{tr('hint')}</p></div></div>
        <button className="ct-button" disabled={api.loading || !api.hasToken || data.dialogTask.busy} onClick={() => void data.loadDialogs(true)}><RefreshIcon />{tr(data.total === null ? 'load_dialogs' : 'refresh')}</button>
      </div>
      {data.dialogTask.error && <p className="ct-error" role="alert">{t('tools.' + data.dialogTask.error)}</p>}
      {data.total !== null && <><div className="ct-search"><SearchIcon /><input aria-label={tr('dialog_search')} placeholder={tr('dialog_search')} value={dialogSearch} onChange={e => setDialogSearch(e.target.value)} /></div>
        <div className="ct-dialogs">{dialogs.map(dialog => <button className="ct-dialog" key={dialog.id} aria-pressed={data.peer === dialog.id} onClick={() => { data.setPeer(dialog.id); setSearch(''); }}>
          <span className="ct-avatar">{dialog.avatar ? <img src={dialog.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <UsersIcon />}</span><span>{dialog.title}</span></button>)}</div>
        {!dialogs.length && <p className="ct-empty">{tr('no_dialogs')}</p>}
        {data.moreDialogs && <button className="ct-button" disabled={data.dialogTask.busy} onClick={() => void data.loadDialogs()}>{tr('more_dialogs')}</button>}
      </>}
      {data.dialogTask.busy && <p className="ct-note" role="status">{t('tools.loading')}</p>}
    </section>
    {selected && <section className="ct-panel">
      <div className="ct-heading"><div><h3>{selected.title}</h3><p>{tr('search_hint')}</p></div><AttachIcon className="w-5 h-5 text-primary" /></div>
      <div className="ct-tabs" role="group" aria-label={tr('type')}>{MEDIA_TYPES.map(type => { const Icon = fileIcons[type]; return <button key={type} aria-pressed={data.type === type} onClick={() => { data.setType(type as MediaType); setSearch(''); }}><Icon />{tr('types.' + type)}</button>; })}</div>
      <div className="ct-toolbar"><div className="ct-search"><SearchIcon /><input value={search} onChange={e => setSearch(e.target.value)} aria-label={tr('search')} placeholder={tr('search')} /></div>
        <button className="ct-button ct-button--primary" disabled={data.fileTask.busy || !api.hasToken} onClick={() => void data.loadFiles(true)}><RefreshIcon />{tr(data.loaded ? 'refresh' : 'load_files')}</button></div>
      {data.fileTask.error && <p className="ct-error mt-3" role="alert">{t('tools.' + data.fileTask.error)}</p>}
      {data.fileTask.busy && <div className="ct-progress" role="status">{t('tools.loading')}<button className="ct-button" onClick={data.fileTask.cancel}>{t('tools.cancel')}</button></div>}
      {!data.fileTask.busy && !files.length && <p className="ct-empty">{tr(data.loaded ? 'empty' : 'load_hint')}</p>}
      <FileGallery files={files.map(file => ({ ...file, peerId: selected.id, dialogTitle: selected.title }))} />
      {data.next && <button className="ct-button" disabled={data.fileTask.busy} onClick={() => void data.loadFiles()}>{tr('more_files')}</button>}
    </section>}
    </div>
  </div>;
}
