import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { downloadBlob } from '@/shared/utils/download.js';
import { Select } from '@/popup/components/ui/FormControls.js';
import { downloadCatalogZip, downloadCatalogFiles, type CatalogDownloadItem, type CatalogDownloadKind, type CatalogDownloadReport } from '@/shared/catalog-download.js';

export default function CatalogDownloads({ kind, ownerId, scope = '', items, disabled, onBusyChange, onSaved }: {
  kind: CatalogDownloadKind; ownerId: string | null; scope?: string; items: CatalogDownloadItem[]; disabled: boolean;
  onBusyChange: (busy: boolean) => void; onSaved: (keys: string[]) => void;
}) {
  const { t } = useTranslation('center'), tr = (key: string, values?: Record<string, unknown>) => t('catalog_download.' + key, values);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [report, setReport] = useState<CatalogDownloadReport | null>(null);
  const [format, setFormat] = useState<'zip' | 'files'>('zip'), [reportFormat, setReportFormat] = useState<'zip' | 'files'>('zip');
  const [quality, setQuality] = useState<number | 'best'>('best');
  const [progress, setProgress] = useState({ done: 0, total: 0, title: '', bytes: 0 });
  const active = useRef<AbortController | null>(null), version = useRef(0);
  const callbacks = useRef({ onBusyChange, onSaved }); callbacks.current = { onBusyChange, onSaved };
  useEffect(() => {
    version.current++; active.current?.abort(); active.current = null;
    setBusy(false); setError(''); setReport(null); callbacks.current.onBusyChange(false);
    return () => { version.current++; active.current?.abort(); callbacks.current.onBusyChange(false); };
  }, [ownerId, scope, kind]);
  const start = async (requested = format, retry = false) => {
    const retryKeys = report && new Set([...report.failed.map(f => f.key), ...report.remaining]);
    const targets = items.filter(item => !retry || retryKeys?.has(item.key)).map(item => ({ ...item }));
    if (disabled || busy || active.current || !ownerId || !targets.length) return;
    const mode = targets.length === 1 ? 'files' : requested;
    const controller = new AbortController(), id = version.current;
    const current = () => version.current === id;
    active.current = controller; setBusy(true); setError(''); setReport(null); setReportFormat(mode); callbacks.current.onBusyChange(true);
    setProgress({ done: 0, total: targets.length, title: targets[0].title, bytes: 0 });
    const call = async (method: string, params: Record<string, unknown>) => {
      if (controller.signal.aborted) throw new Error('CANCELLED');
      const result = await sendMessage({ type: 'VK_API_CALL', method, params, expectedUserId: ownerId });
      if (!result.success) throw Object.assign(new Error(result.error || 'DOWNLOAD_FAILED'), { code: result.code });
      return result.data;
    };
    try {
      let result: CatalogDownloadReport;
      const update = (done: number, total: number, title: string, bytes: number) => { if (current()) setProgress({ done, total, title, bytes }); };
      if (mode === 'files') {
        result = await downloadCatalogFiles(kind, targets, call, controller.signal, async (url, filename) => {
          if (!current() || controller.signal.aborted) throw new Error('CANCELLED');
          const response = await sendMessage({ type: kind === 'video' ? 'DOWNLOAD_VIDEO' : 'DOWNLOAD_ATTACHMENT', url, filename });
          if (!response.success) throw new Error('DOWNLOAD_FAILED');
        }, update, quality);
      } else {
        result = await downloadCatalogZip(kind, targets, call, controller.signal,
          update, (blob, filename) => { if (current()) downloadBlob(blob, filename); }, { quality });
      }
      if (current()) { setReport(result); callbacks.current.onSaved(result.saved); }
    } catch (err) {
      if (current() && !controller.signal.aborted) setError((err as Error).message);
    } finally {
      if (current()) { active.current = null; setBusy(false); callbacks.current.onBusyChange(false); }
    }
  };
  const canRetry = report && items.some(item => report.remaining.includes(item.key) || report.failed.some(f => f.key === item.key));
  const errorText = (code: string) => tr('errors.' + (['NO_SOURCE', 'FILE_TOO_LARGE', 'EMPTY_DOWNLOAD', 'NOT_A_FILE', 'NETWORK_ERROR', 'HOST_PERMISSION', 'DOWNLOAD_TIMEOUT', 'HTTP_403', 'HTTP_404'].includes(code) ? code : 'DOWNLOAD_FAILED'));
  return <div className="ct-catalog-download" aria-label={tr('heading')}>
    <div className="ct-download-heading"><div><strong>{tr('heading')}</strong><p className="ct-note">{items.length ? tr('selected', { count: items.length }) : tr('select_hint')}</p></div>
      <button type="button" className="ct-button ct-download-primary" disabled={disabled || busy || !ownerId || !items.length} onClick={() => void start()}>
        <DownloadIcon />{items.length > 1 && format === 'zip' ? tr('zip') : t('bulk.download_files')} · {items.length}
      </button></div>
    {!!items.length && !busy && <div className="ct-download-options">
      {items.length > 1 && <div className="ct-download-formats" role="group" aria-label={tr('format')}>
        {(['zip', 'files'] as const).map(mode => <button key={mode} type="button" aria-pressed={format === mode} disabled={disabled} onClick={() => setFormat(mode)}>{tr('format_' + mode)}</button>)}
      </div>}
      {kind === 'video' && <label className="ct-download-quality">{tr('quality')}<Select aria-label={tr('quality')} value={quality} disabled={disabled} onChange={e => setQuality(e.target.value === 'best' ? 'best' : Number(e.target.value))}>
        <option value="best">{tr('best')}</option>{[1080, 720, 480, 360].map(value => <option key={value} value={value}>{value}p</option>)}
      </Select></label>}
      <p className="ct-note">{tr(items.length > 1 && format === 'zip' ? 'zip_hint' : 'files_hint')}</p>
      {kind === 'video' && <p className="ct-note">{tr('quality_hint')}</p>}
      {items.length > 1 && format === 'zip' && <details className="ct-download-details"><summary>{tr('limits')}</summary><p className="ct-note">{tr('limits_hint')}</p></details>}
    </div>}
    {busy && <div className="ct-download-progress" role="status" aria-live="polite"><div className="ct-download-heading"><strong>{tr('progress', { done: progress.done, total: progress.total })}</strong><button type="button" className="ct-button" onClick={() => active.current?.abort()}>{t('tools.cancel')}</button></div>
      <progress aria-label={tr('heading')} value={progress.done} max={Math.max(1, progress.total)} /><p className="ct-note">{progress.title}{progress.bytes > 0 && ` · ${(progress.bytes / 1024 ** 2).toFixed(1)} MB`}</p></div>}
    {report && <div className="ct-download-result"><p role="status"><strong>{tr(reportFormat === 'zip' ? 'saved' : 'queued', { count: report.saved.length })}</strong>{report.archives.length > 0 && ` · ${tr('archives', { count: report.archives.length })}`}</p>
      {report.cancelled && <p className="ct-note">{tr('cancelled')}</p>}
      {report.stoppedCode && <p className="ct-error">{tr('stopped')}</p>}
      {!!report.remaining.length && <p className="ct-note">{tr('remaining', { count: report.remaining.length })}</p>}
      {!!report.failed.length && <details className="ct-download-details" open><summary>{tr('failed', { count: report.failed.length })}</summary><ul>{report.failed.map(f => <li key={f.key}><strong>{f.title}</strong><span>{errorText(f.code)}</span></li>)}</ul>
        <details><summary>{tr('technical')}</summary><ul>{report.failed.map(f => <li key={f.key}>{f.title}: {f.code}{f.host && ` · ${f.host}`}</li>)}</ul></details></details>}
      {canRetry && <div className="ct-toolbar"><button type="button" className="ct-button" disabled={disabled || busy} onClick={() => void start(reportFormat, true)}>{tr('retry')}</button>
        {reportFormat === 'zip' && !!report.failed.length && <button type="button" className="ct-button" disabled={disabled || busy} onClick={() => { setFormat('files'); void start('files', true); }}>{tr('fallback')}</button>}</div>}
    </div>}
    {error && <p role="alert" className="ct-error">{tr('error')}</p>}
  </div>;
}
