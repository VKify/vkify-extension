import { object, type CenterApi } from './center-tools.js';
import { buildZipBlobs, crc32 } from './utils/zip.js';
import { downloadBlob } from './utils/download.js';
import { sanitizeFilename } from './utils/filename.js';
import { bulkDelay } from './bulk-actions.js';
import { selectVideoDownloadFile } from './video-download-quality.js';

export type CatalogDownloadKind = 'photo' | 'video' | 'doc';
export interface CatalogDownloadItem { key: string; title: string; filename: string; source?: string | null; videoReference?: string }
export interface CatalogDownloadReport {
  saved: string[]; failed: { key: string; title: string; code: string; host?: string }[];
  remaining: string[]; archives: string[]; cancelled: boolean; stoppedCode?: string;
}
const PART_BYTES = 512 * 1024 ** 2;
const FILE_BYTES = 3 * 1024 ** 3; // STORE ZIP32; leave room for headers and directory.
const FOLDERS = { photo: 'photos', video: 'videos', doc: 'documents' };
export function catalogFilename(name: string, key: string): string {
  const clean = sanitizeFilename(name).replace(/[\u0000-\u001f]/g, '_').replace(/[. ]+$/, '');
  return `${key.replace(/[^a-z0-9_-]/gi, '_')}-${clean || 'file'}`;
}

/** Same video.get MP4 sources used by the existing video download button. */
export async function resolveCatalogFile(item: CatalogDownloadItem, call: CenterApi, quality: number | 'best' = 'best'): Promise<string> {
  let source = item.source;
  if (item.videoReference) {
    const page = object(await call('video.get', { videos: item.videoReference, extended: 0 }));
    const video = object(Array.isArray(page.items) ? page.items[0] : null);
    const files = object(video.files);
    source = selectVideoDownloadFile(files, quality)?.url;
  }
  if (!source) throw new Error('NO_SOURCE');
  const url = new URL(source);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('NO_SOURCE');
  return url.href;
}

/** Stream into native Blob parts and calculate CRC per chunk, without a giant arrayBuffer. */
async function fetchFile(url: string, filename: string, signal: AbortSignal, onBytes: (bytes: number) => void) {
  const controller = new AbortController(), abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 5 * 60 * 1000);
  try {
    if (signal.aborted) throw new Error('CANCELLED');
    // Browser playlist downloads send cookies. ZIP reads need the same session
    // and host permission, including the legacy/current video CDN domains.
    if (typeof chrome !== 'undefined' && chrome.permissions?.contains
      && !await chrome.permissions.contains({ origins: [`https://${new URL(url).hostname}/*`] })) {
      throw Object.assign(new Error('HOST_PERMISSION'), { host: new URL(url).hostname });
    }
    const response = await fetch(url, { credentials: 'include', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    if (Number(response.headers.get('content-length')) > FILE_BYTES) { await response.body?.cancel(); throw new Error('FILE_TOO_LARGE'); }
    if (response.headers.get('content-type')?.includes('text/html') && !/\.html?$/i.test(filename)) {
      await response.body?.cancel(); throw new Error('NOT_A_FILE');
    }
    if (!response.body) throw new Error('EMPTY_DOWNLOAD');
    const reader = response.body.getReader(), chunks: Blob[] = [];
    let bytes = 0, crc = 0;
    try {
      while (true) {
        if (signal.aborted) throw new Error('CANCELLED');
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > FILE_BYTES) throw new Error('FILE_TOO_LARGE');
        crc = crc32(chunk.value, crc);
        chunks.push(new Blob([chunk.value as BlobPart]));
        onBytes(bytes);
      }
      if (!bytes) throw new Error('EMPTY_DOWNLOAD');
      return { data: new Blob(chunks), crc };
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  } catch (error) {
    if (!signal.aborted && controller.signal.aborted) throw new Error('DOWNLOAD_TIMEOUT');
    if (error instanceof TypeError) throw new Error('NETWORK_ERROR');
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

/** Partial archives and a per-file report follow the existing photo/music ZIP behavior. */
export async function downloadCatalogZip(kind: CatalogDownloadKind, items: CatalogDownloadItem[], call: CenterApi, signal: AbortSignal,
  progress: (done: number, total: number, title: string, bytes: number) => void,
  save: (blob: Blob, filename: string) => void = downloadBlob,
  options: { partBytes?: number; quality?: number | 'best' } = {}): Promise<CatalogDownloadReport> {
  const targets = [...new Map(items.map(item => [item.key, item])).values()];
  const report: CatalogDownloadReport = { saved: [], failed: [], remaining: [], archives: [], cancelled: false };
  const folder = FOLDERS[kind], base = `vkify-${folder}-${new Date().toISOString().slice(0, 10)}`;
  let entries: Parameters<typeof buildZipBlobs>[0] = [], size = 0, done = 0;
  const flush = () => {
    if (!entries.length) return;
    const filename = `${base}-part-${String(report.archives.length + 1).padStart(3, '0')}.zip`;
    save(buildZipBlobs(entries), filename); report.archives.push(filename);
    entries = []; size = 0;
  };
  for (const item of targets) {
    if (signal.aborted) break;
    progress(done, targets.length, item.title, 0);
    try {
      const url = await resolveCatalogFile(item, call, options.quality);
      if (signal.aborted) break;
      const file = await fetchFile(url, item.filename, signal, bytes => progress(done, targets.length, item.title, bytes));
      if (signal.aborted) break;
      if (entries.length && (size + file.data.size > (options.partBytes ?? PART_BYTES) || entries.length >= 500)) flush();
      entries.push({ name: `${folder}/${catalogFilename(item.filename, item.key)}`, ...file }); size += file.data.size;
      report.saved.push(item.key);
    } catch (error) {
      if (signal.aborted) break;
      const err = error as { code?: string; message?: string; host?: string };
      const code = String(err.code || err.message || 'DOWNLOAD_FAILED');
      if (['ACCOUNT_CHANGED', '5', '6', '9', '14', '29', 'TOKEN_EXPIRED', 'expired', 'no_token'].includes(code)) { report.stoppedCode = code; break; }
      report.failed.push({ key: item.key, title: item.title, code: /^[A-Z0-9_]+$/.test(code) ? code : 'DOWNLOAD_FAILED', ...(err.host ? { host: err.host } : {}) });
    }
    done++;
    progress(done, targets.length, item.title, 0);
    if (kind === 'video' && done < targets.length) await bulkDelay(1100, signal);
  }
  report.cancelled = signal.aborted;
  report.remaining = targets.filter(item => !report.saved.includes(item.key) && !report.failed.some(f => f.key === item.key)).map(item => item.key);
  if (entries.length && (report.failed.length || report.remaining.length)) {
    const data = new TextEncoder().encode(JSON.stringify({ ...report, archives: undefined }, null, 2));
    entries.push({ name: '_download-report.json', data: new Blob([data]), crc: crc32(data) });
  }
  flush();
  return report;
}

/** Queue the files through chrome.downloads, as the existing playlist button does. */
export async function downloadCatalogFiles(kind: CatalogDownloadKind, items: CatalogDownloadItem[], call: CenterApi, signal: AbortSignal,
  queue: (url: string, filename: string) => Promise<void>, progress: (done: number, total: number, title: string, bytes: number) => void,
  quality: number | 'best' = 'best'): Promise<CatalogDownloadReport> {
  const targets = [...new Map(items.map(item => [item.key, item])).values()];
  const report: CatalogDownloadReport = { saved: [], failed: [], remaining: [], archives: [], cancelled: false };
  let done = 0;
  for (const item of targets) {
    if (signal.aborted) break;
    progress(done, targets.length, item.title, 0);
    try {
      const url = await resolveCatalogFile(item, call, quality);
      if (signal.aborted) break;
      const name = targets.length > 1 ? catalogFilename(item.filename, item.key)
        : sanitizeFilename(item.filename).replace(/[\u0000-\u001f]/g, '_');
      await queue(url, name || catalogFilename('file', item.key));
      report.saved.push(item.key);
    } catch (error) {
      if (signal.aborted) break;
      const err = error as { code?: string; message?: string }, code = String(err.code || err.message || 'DOWNLOAD_FAILED');
      if (['ACCOUNT_CHANGED', '5', '6', '9', '14', '29', 'TOKEN_EXPIRED', 'expired', 'no_token'].includes(code)) { report.stoppedCode = code; break; }
      report.failed.push({ key: item.key, title: item.title, code: /^[A-Z0-9_]+$/.test(code) ? code : 'DOWNLOAD_FAILED' });
    }
    progress(++done, targets.length, item.title, 0);
    if (done < targets.length) await bulkDelay(kind === 'video' ? 1100 : 250, signal);
  }
  report.cancelled = signal.aborted;
  report.remaining = targets.filter(item => !report.saved.includes(item.key) && !report.failed.some(f => f.key === item.key)).map(item => item.key);
  return report;
}
