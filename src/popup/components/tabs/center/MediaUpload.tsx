import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/popup/components/ui/FormControls.js';
import { PhotoAlbumIcon, UploadIcon, VideoIcon, FileTextIcon, XIcon, CheckCircleIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { uploadMedia } from '@/shared/media-upload.js';
import { object } from '@/shared/center-tools.js';
import { UPLOAD_LIMITS, UPLOAD_FILE_DELAY_MS, UPLOAD_API_DELAY_MS, pacedUploadApi, validateUploadFiles, uploadErrorReason, uploadErrorDetails } from '@/shared/upload-policy.js';
import { bulkDelay } from '@/shared/bulk-actions.js';
import './MediaUpload.css';

export default function MediaUpload({ kind, ownerId, albums, disabled, onBusyChange, onUploaded }: {
  kind: 'photo' | 'video' | 'doc'; ownerId: string | null; albums: { id: number; title: string; canUpload?: boolean }[];
  disabled: boolean; onBusyChange: (busy: boolean) => void; onUploaded: () => void;
}) {
  const { t } = useTranslation('center'), tr = (key: string, values?: Record<string, unknown>) => t('media_upload.' + key, values);
  const [files, setFiles] = useState<File[]>([]), [album, setAlbum] = useState(''), [title, setTitle] = useState('');
  const [description, setDescription] = useState(''), [newAlbum, setNewAlbum] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(0), [percent, setPercent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [delay, setDelay] = useState(UPLOAD_FILE_DELAY_MS), [waiting, setWaiting] = useState(false), [activeFile, setActiveFile] = useState('');
  const [report, setReport] = useState<{ failed: number; remaining: number } | null>(null);
  const [retry, setRetry] = useState<{ attempt: number; total: number } | null>(null);
  const controller = useRef<AbortController | null>(null), input = useRef<HTMLInputElement>(null);
  const callbacks = useRef({ onBusyChange, onUploaded }); callbacks.current = { onBusyChange, onUploaded };
  const chooseFiles = (chosen: File[]) => { setFiles(chosen); setDone(0); setError(''); setReport(null); };
  const limits = UPLOAD_LIMITS[kind], issues = validateUploadFiles(kind, files);
  const limitSize = kind === 'video' ? '2 GB' : `${limits.bytes / 1024 ** 2} MB`;
  const MediaIcon = kind === 'photo' ? PhotoAlbumIcon : kind === 'doc' ? FileTextIcon : VideoIcon;
  useEffect(() => {
    setFiles([]); setAlbum(''); setError(''); setDone(0); setBusy(false); setReport(null); setActiveFile(''); setWaiting(false); setRetry(null);
    return () => { controller.current?.abort(); controller.current = null; callbacks.current.onBusyChange(false); };
  }, [ownerId]);
  const start = async () => {
    if (!ownerId || busy || disabled || !files.length || issues.length || controller.current) return;
    const active = new AbortController(); controller.current = active;
    const current = () => controller.current === active;
    const call = pacedUploadApi(async (method: string, params: Record<string, unknown>) => {
      if (active.signal.aborted) throw new Error('UPLOAD_CANCELLED');
      const response = await sendMessage({ type: 'VK_API_CALL', method, params, expectedUserId: ownerId });
      if (!response.success) throw Object.assign(new Error(response.error || 'REQUEST_FAILED'), { code: response.code, method });
      return response.data;
    }, active.signal, () => { if (current()) setWaiting(true); });
    setBusy(true); callbacks.current.onBusyChange(true); setError(''); setDone(0); setReport(null); setActiveFile(''); setRetry(null);
    let completed = 0, createdAlbum = false;
    let attemptedFile: File | null = null;
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
        attemptedFile = file;
        if (current()) { setPercent(0); setActiveFile(file.name); setWaiting(false); setRetry(null); }
        await uploadMedia(kind, file, target, call, active.signal, value => { if (current()) { setPercent(value); setWaiting(false); } }, files.length === 1 ? title : '', description,
          (attempt, total) => { if (current()) { setRetry({ attempt, total }); setPercent(0); setWaiting(true); } });
        completed++;
        attemptedFile = null;
        if (current()) { setDone(completed); setFiles(old => old.filter(item => item !== file)); setRetry(null); }
        if (completed < files.length && !active.signal.aborted) { if (current()) setWaiting(true); await bulkDelay(delay, active.signal); }
      }
      if (current() && input.current) input.current.value = '';
      if (current()) {
        setReport({ failed: 0, remaining: files.length - completed });
        if (active.signal.aborted) setError(tr('reasons.cancelled'));
      }
    } catch (err) {
      if (current()) {
        const reason = uploadErrorReason(err), details = uploadErrorDetails(err);
        setError(`${attemptedFile ? tr('failed_file', { name: attemptedFile.name }) : tr('setup_error')} ${tr('reasons.' + reason)}${details ? ` ${details}` : ''}`);
        setReport({ failed: attemptedFile ? 1 : 0, remaining: files.length - completed - (attemptedFile ? 1 : 0) });
      }
    }
    finally {
      // Refresh reads share the same account budget as users.get + the last save.
      if (current() && !active.signal.aborted) { setWaiting(true); await bulkDelay(UPLOAD_API_DELAY_MS, active.signal); }
      if (current()) {
        controller.current = null; setBusy(false); setWaiting(false); callbacks.current.onBusyChange(false);
        if (!active.signal.aborted && (completed || createdAlbum || kind === 'video')) callbacks.current.onUploaded();
      }
    }
  };
  return <section className="ct-panel media-upload">
    <div className="ct-heading"><div className="media-upload-heading"><span className="media-upload-icon"><UploadIcon /></span><h3>{tr(kind + '_title')}</h3></div></div>
    <p className="ct-note">{tr(kind + '_hint')}</p>
    <p className="media-upload-limits">{tr('limits', { count: limits.files, size: limitSize })}</p>
    <input className="media-upload-input" aria-label={tr('files')} ref={input} type="file" multiple accept={kind === 'doc' ? undefined : kind === 'video' ? 'video/*,.mkv,.avi,.mov,.mp4,.webm' : 'image/jpeg,image/png,image/gif,image/webp'} disabled={busy || disabled} onChange={e => chooseFiles(Array.from(e.target.files || []))} />
    <button type="button" className={`media-upload-dropzone${dragging ? ' media-upload-dropzone--active' : ''}`} disabled={busy || disabled} onClick={() => { if (input.current) { input.current.value = ''; input.current.click(); } }}
      onDragOver={e => { e.preventDefault(); if (!busy && !disabled) setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (!busy && !disabled) chooseFiles(Array.from(e.dataTransfer.files)); }}>
      <span className="media-upload-drop-icon"><MediaIcon /></span><strong>{tr(kind + '_choose')}</strong><span className="media-upload-drop-hint">{tr('drop_hint')}</span><span className="media-upload-formats">{tr(kind + '_formats')}</span>
    </button>
    {!!files.length && <div className="media-upload-selection"><div className="media-upload-selection-heading"><strong>{tr('selected', { count: files.length })}</strong><span>{(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB</span></div>
      <ul className="media-upload-files">{files.map((file, index) => <li key={index}><span className="media-upload-file-icon"><MediaIcon /></span><span className="media-upload-file-info"><strong title={file.name}>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small></span><button type="button" className="media-upload-remove" aria-label={tr('remove', { name: file.name })} disabled={busy || disabled} onClick={() => setFiles(old => old.filter((_, i) => i !== index))}><XIcon /></button></li>)}</ul>
    </div>}
    {!!issues.length && <ul className="media-upload-validation ct-error" role="alert">{issues.map((issue, index) => <li key={index}>{tr('validation.' + issue.key, { name: issue.name, count: limits.files, size: limitSize })}</li>)}</ul>}
    <div className="media-upload-fields">
      {kind !== 'doc' && <label><span>{t('bulk.target_album')}</span><Select className="w-full" icon={<PhotoAlbumIcon />} value={album} disabled={busy || disabled} onChange={e => setAlbum(e.target.value)}>
        <option value="">{kind === 'video' ? tr('no_album') : t('bulk.choose_album')}</option>
        {albums.filter(a => a.id > 0 && a.canUpload !== false).map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
      </Select></label>}
      {kind === 'photo' && <label><span>{tr('new_album')}</span><Input className="w-full" placeholder={tr('album_placeholder')} value={newAlbum} disabled={busy || disabled} onChange={e => setNewAlbum(e.target.value)} maxLength={128} /></label>}
      {kind !== 'photo' && files.length <= 1 && <label><span>{tr(kind === 'doc' ? 'doc_name' : 'name')}</span><Input className="w-full" placeholder={tr('name_placeholder')} value={title} disabled={busy || disabled} onChange={e => setTitle(e.target.value)} maxLength={kind === 'doc' ? 128 : 250} /></label>}
      <label className={kind === 'doc' ? '' : 'media-upload-caption'}><span>{tr(kind === 'doc' ? 'tags' : 'description')}</span><Input className="w-full" placeholder={tr(kind === 'doc' ? 'tags_placeholder' : 'description_placeholder')} value={description} disabled={busy || disabled} onChange={e => setDescription(e.target.value)} maxLength={2048} /></label>
      <label><span>{tr('delay')}</span><Select className="w-full" value={delay} disabled={busy || disabled} onChange={e => setDelay(Number(e.target.value))}>{[3000, 5000, 10000, 30000].map(ms => <option key={ms} value={ms}>{t('bulk.seconds', { count: ms / 1000 })}</option>)}</Select></label>
    </div>
    <p className="ct-note media-upload-pacing">{tr('pacing')}</p>
    <div className="media-upload-footer"><span className="ct-note">{tr(files.length ? 'ready' : 'empty_selection')}</span><button className="ct-button ct-button--primary" disabled={busy || disabled || !!issues.length || !files.length || !ownerId || (kind === 'photo' && !album && !newAlbum.trim())} onClick={() => void start()}><UploadIcon />{tr('start')}</button></div>
    {busy && <div className="media-upload-progress" role="status" aria-live="polite"><div><span>{retry && `${tr('retry', retry)} `}{waiting ? tr('waiting') : tr('progress', { count: done, percent })}{activeFile && <small className="media-upload-active-file">{activeFile}</small>}</span><button className="ct-button" onClick={() => controller.current?.abort()}>{t('tools.cancel')}</button></div><progress value={percent} max={100} /></div>}
    {!busy && done > 0 && <p role="status" className="media-upload-success"><CheckCircleIcon /><span>{tr('success', { count: done })}{kind === 'video' && ` ${tr('processing')}`}</span></p>}
    {error && <p role="alert" className="ct-error">{error}</p>}
    {!busy && report && (report.failed > 0 || report.remaining > 0) && <p className="ct-note media-upload-report" role="status">{tr('report', { success: done, failed: report.failed, remaining: report.remaining })} {tr('remaining_hint')}</p>}
  </section>;
}
