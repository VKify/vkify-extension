import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendMessage } from '@/shared/messaging.js';
import { downloadText } from '@/shared/utils/download.js';
import { runBulkActions, type BulkJob, type BulkReport } from '@/shared/bulk-actions.js';
import './CenterTools.css';

export interface BulkAction { key: string; jobs: BulkJob[] }
export default function BulkActions({ ownerId, scope = '', actions, disabled = false, onSuccess, onBusyChange }: {
  ownerId: string | null; scope?: string; actions: BulkAction[]; disabled?: boolean;
  onSuccess?: (job: BulkJob) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation('center');
  const [delay, setDelay] = useState(2), [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BulkAction | null>(null);
  const [report, setReport] = useState<BulkReport | null>(null);
  const [actionKey, setActionKey] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null), version = useRef(0);
  const busyCallback = useRef(onBusyChange), successCallback = useRef(onSuccess);
  busyCallback.current = onBusyChange; successCallback.current = onSuccess;
  useEffect(() => {
    version.current++; controller.current?.abort(); controller.current = null;
    setBusy(false); setPending(null); setReport(null); setError('');
    busyCallback.current?.(false);
    return () => { version.current++; controller.current?.abort(); busyCallback.current?.(false); };
  }, [ownerId, scope]);
  const start = async () => {
    if (!pending || !ownerId || busy || controller.current || disabled) return;
    const active = new AbortController(), id = version.current;
    const current = () => version.current === id;
    controller.current = active; setBusy(true); busyCallback.current?.(true); setError(''); setReport(null);
    const targets = pending.jobs.map(job => ({ ...job, params: { ...job.params } }));
    setActionKey(pending.key);
    setProgress({ done: 0, total: targets.length }); setPending(null);
    try {
      const result = await runBulkActions(targets, async (method, params) => {
        if (method === 'download.attachment') {
          const response = await sendMessage({ type: 'DOWNLOAD_ATTACHMENT', url: String(params.url), filename: String(params.filename) });
          if (!response.success) throw new Error(response.error ?? 'DOWNLOAD_FAILED');
          return 1;
        }
        const response = await sendMessage({ type: 'VK_API_CALL', method, params, expectedUserId: ownerId });
        if (!response.success) throw Object.assign(new Error(response.error ?? 'REQUEST_FAILED'), { code: response.code });
        return response.data;
      }, active.signal, delay * 1000, (result, done, total) => {
        if (!current()) return;
        setProgress({ done, total });
        if (result.success) successCallback.current?.(result.job);
      });
      if (current()) setReport(result);
    } catch (err) { if (current()) setError((err as Error).message); }
    finally {
      if (current()) { controller.current = null; setBusy(false); busyCallback.current?.(false); }
    }
  };
  const tr = (key: string) => t('bulk.' + key);
  return <div className="ct-bulk">
    <div className="ct-toolbar">
      <label>{tr('delay')}<select value={delay} disabled={busy || !!pending} onChange={e => setDelay(Number(e.target.value))}>
        {[1, 2, 3, 5, 10, 30].map(seconds => <option key={seconds} value={seconds}>{t('bulk.seconds', { count: seconds })}</option>)}
      </select></label>
      {actions.map(action => <button type="button" className="ct-button" key={action.key} disabled={busy || disabled || !ownerId || !action.jobs.length}
        onClick={() => { setPending({ ...action, jobs: [...action.jobs] }); setError(''); }}>{tr(action.key)} · {action.jobs.length}</button>)}
    </div>
    <p className="ct-note">{tr('lifecycle')}</p>
    {pending && <div className="ct-bulk-confirm" role="group" aria-label={tr('review')}>
      <strong>{tr(pending.key)} · {pending.jobs.length}</strong><p className="ct-note">{tr('confirm_note')}</p>
      {pending.key === 'unsubscribe' && <p className="ct-note">{tr('unsubscribe_note')}</p>}
      {pending.key === 'delete_videos' && <p className="ct-note">{tr('video_note')}</p>}
      {pending.key === 'mark_read' && <p className="ct-note">{tr('read_note')}</p>}
      <ul className="ct-bulk-targets">{pending.jobs.map(job => <li key={job.id}>{job.title} <small>({job.id})</small></li>)}</ul>
      <div className="ct-toolbar"><button type="button" className="ct-button ct-button--primary" disabled={disabled} onClick={() => void start()}>{tr('confirm')}</button>
        <button type="button" className="ct-button" onClick={() => setPending(null)}>{t('tools.cancel')}</button></div>
    </div>}
    {busy && <div className="ct-progress" role="status" aria-live="polite"><span>{progress.done} / {progress.total}</span><progress value={progress.done} max={Math.max(1, progress.total)} />
      <button type="button" className="ct-button" onClick={() => controller.current?.abort()}>{tr('stop')}</button></div>}
    {report && <div role="status" aria-live="polite"><p className="ct-note">{t('bulk.result', { success: report.results.filter(r => r.success).length, failed: report.results.filter(r => !r.success).length, remaining: report.remaining.length })}</p>
      <button type="button" className="ct-button" onClick={() => downloadText(JSON.stringify(report, null, 2), 'vkify-actions-report.json', 'application/json')}>{tr('export_report')}</button>
      {!!report.remaining.length && <button type="button" className="ct-button" disabled={disabled || busy} onClick={() => setPending({ key: actionKey, jobs: report.remaining })}>{tr('resume')}</button>}
      {report.results.some(r => !r.success) && <ul className="ct-bulk-targets ct-error">{report.results.filter(r => !r.success).map(r => <li key={r.job.id}>{r.job.title}: {r.code === 'UNEXPECTED_RESULT' ? tr('unexpected') : r.error} {r.code && `(${r.code})`}</li>)}</ul>}
    </div>}
    {error && <p role="alert" className="ct-error">{tr('error')} {error}</p>}
  </div>;
}
