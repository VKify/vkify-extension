import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/popup/components/ui/FormControls.js';
import { PhotoAlbumIcon, UploadIcon, VideoIcon, XIcon, CheckCircleIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { uploadMedia } from '@/shared/media-upload.js';
import { object } from '@/shared/center-tools.js';
import './MediaUpload.css';

export default function MediaUpload({ kind, ownerId, albums, disabled, onBusyChange, onUploaded }: {
  kind: 'photo' | 'video'; ownerId: string | null; albums: { id: number; title: string; canUpload?: boolean }[];
  disabled: boolean; onBusyChange: (busy: boolean) => void; onUploaded: () => void;
}) {
  const { t } = useTranslation('center'), tr = (key: string, values?: Record<string, unknown>) => t('media_upload.' + key, values);
  const [files, setFiles] = useState<File[]>([]), [album, setAlbum] = useState(''), [title, setTitle] = useState('');
  const [description, setDescription] = useState(''), [newAlbum, setNewAlbum] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(0), [percent, setPercent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const controller = useRef<AbortController | null>(null), input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onBusyChange, onUploaded }); callbacks.current = { onBusyChange, onUploaded };
  const chooseFiles = (chosen: File[]) => { setFiles(chosen); setDone(0); setError(''); };
  const MediaIcon = kind === 'photo' ? PhotoAlbumIcon : VideoIcon;
  useEffect(() => {
    setFiles([]); setAlbum(''); setError(''); setDone(0); setBusy(false);
    return () => { controller.current?.abort(); controller.current = null; callbacks.current.onBusyChange(false); };
  }, [ownerId]);
  const start = async () => {
    if (!ownerId || busy || disabled || !files.length || controller.current) return;
    const active = new AbortController(); controller.current = active;
    const current = () => controller.current === active;
    const call = async (method: string, params: Record<string, unknown>) => {
      if (active.signal.aborted) throw new Error('UPLOAD_CANCELLED');
      const response = await sendMessage({ type: 'VK_API_CALL', method, params, expectedUserId: ownerId });
      if (!response.success) throw Object.assign(new Error(response.error || 'REQUEST_FAILED'), { code: response.code });
      return response.data;
    };
    setBusy(true); callbacks.current.onBusyChange(true); setError(''); setDone(0);
    let completed = 0, createdAlbum = false;
    try {
      let target = album ? Number(album) : null;
      if (kind === 'photo' && newAlbum.trim()) {
        const created = object(await call('photos.createAlbum', { title: newAlbum.trim() }));
        if (!Number.isSafeInteger(created.id) || Number(created.id) <= 0) throw new Error('INVALID_ALBUM_RESPONSE');
        createdAlbum = true;
        target = Number(created.id); if (current()) { setAlbum(String(target)); setNewAlbum(''); }
      }
      for (const file of files) {
        if (active.signal.aborted) break;
        if (current()) setPercent(0);
        await uploadMedia(kind, file, target, call, active.signal, value => { if (current()) setPercent(value); }, files.length === 1 ? title : '', description);
        completed++;
        if (current()) { setDone(completed); setFiles(old => old.filter(item => item !== file)); }
        if (completed < files.length && !active.signal.aborted) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (current() && input.current) input.current.value = '';
    } catch { if (current()) setError(tr(active.signal.aborted ? 'cancelled' : 'error')); }
    finally {
      if (current()) {
        controller.current = null; setBusy(false); callbacks.current.onBusyChange(false);
        if (completed || createdAlbum || kind === 'video') callbacks.current.onUploaded();
      }
    }
  };
  return <section className="ct-panel media-upload">
    <div className="ct-heading"><div className="media-upload-heading"><span className="media-upload-icon"><UploadIcon /></span><h3>{tr(kind + '_title')}</h3></div></div>
    <p className="ct-note">{tr(kind + '_hint')}</p>
    <input className="media-upload-input" aria-label={tr('files')} ref={input} type="file" multiple accept={kind === 'video' ? 'video/*,.mkv,.avi,.mov,.mp4,.webm' : 'image/jpeg,image/png,image/gif,image/webp'} disabled={busy || disabled} onChange={e => chooseFiles(Array.from(e.target.files || []))} />
    <button type="button" className={`media-upload-dropzone${dragging ? ' media-upload-dropzone--active' : ''}`} disabled={busy || disabled} onClick={() => { if (input.current) { input.current.value = ''; input.current.click(); } }}
      onDragOver={e => { e.preventDefault(); if (!busy && !disabled) setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (!busy && !disabled) chooseFiles(Array.from(e.dataTransfer.files)); }}>
      <span className="media-upload-drop-icon"><MediaIcon /></span><strong>{tr(kind + '_choose')}</strong><span className="media-upload-drop-hint">{tr('drop_hint')}</span><span className="media-upload-formats">{tr(kind + '_formats')}</span>
    </button>
    {!!files.length && <div className="media-upload-selection"><div className="media-upload-selection-heading"><strong>{tr('selected', { count: files.length })}</strong><span>{(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB</span></div>
      <ul className="media-upload-files">{files.map((file, index) => <li key={index}><span className="media-upload-file-icon"><MediaIcon /></span><span className="media-upload-file-info"><strong title={file.name}>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" className="media-upload-remove" aria-label={tr('remove', { name: file.name })} disabled={busy || disabled} onClick={() => setFiles(old => old.filter((_, i) => i !== index))}><XIcon /></button></li>)}</ul>
    </div>}
    <div className="media-upload-fields">
      <label><span>{t('bulk.target_album')}</span><Select className="w-full" icon={<PhotoAlbumIcon />} value={album} disabled={busy || disabled} onChange={e => setAlbum(e.target.value)}>
        <option value="">{kind === 'video' ? tr('no_album') : t('bulk.choose_album')}</option>
        {albums.filter(a => a.id > 0 && a.canUpload !== false).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
      </Select></label>
      {kind === 'photo' && <label><span>{tr('new_album')}</span><Input className="w-full" placeholder={tr('album_placeholder')} value={newAlbum} disabled={busy || disabled} onChange={e => setNewAlbum(e.target.value)} maxLength={128} /></label>}
      {kind === 'video' && files.length <= 1 && <label><span>{tr('name')}</span><Input className="w-full" placeholder={tr('name_placeholder')} value={title} disabled={busy || disabled} onChange={e => setTitle(e.target.value)} maxLength={250} /></label>}
      <label className="media-upload-caption"><span>{tr('description')}</span><Input className="w-full" placeholder={tr('description_placeholder')} value={description} disabled={busy || disabled} onChange={e => setDescription(e.target.value)} maxLength={2048} /></label>
    </div>
    <div className="media-upload-footer"><span className="ct-note">{tr(files.length ? 'ready' : 'empty_selection')}</span><button className="ct-button ct-button--primary" disabled={busy || disabled || !files.length || !ownerId || (kind === 'photo' && !album && !newAlbum.trim())} onClick={() => void start()}><UploadIcon />{tr('start')}</button></div>
    {busy && <div className="media-upload-progress" role="status" aria-live="polite"><div><span>{tr('progress', { count: done, percent })}</span><button className="ct-button" onClick={() => controller.current?.abort()}>{t('tools.cancel')}</button></div><progress value={percent} max={100} /></div>}
    {!busy && done > 0 && <p role="status" className="media-upload-success"><CheckCircleIcon /><span>{tr('success', { count: done })}{kind === 'video' && ` ${tr('processing')}`}</span></p>}
    {error && <p role="alert" className="ct-error">{error}</p>}
  </section>;
}
