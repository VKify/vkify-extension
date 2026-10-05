import type { CenterApi } from './center-tools.js';
import { object } from './center-tools.js';
import { validateUploadFiles } from './upload-policy.js';
import { bulkDelay } from './bulk-actions.js';

export const PHOTO_UPLOAD_RETRY_DELAYS = [5000, 10000] as const;

function uploadError(code: string, message = code) { return Object.assign(new Error(message), { code }); }

async function uploadStep<T>(method: string, action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw Object.assign(err, { method });
  }
}

/** Only structural metadata, never signed receipt values or upload URLs. */
function receiptShape(uploaded: Record<string, unknown>): string {
  return Object.entries(uploaded).slice(0, 12).map(([key, value]) => {
    const name = /^[a-z_][a-z0-9_]{0,40}$/i.test(key) ? key : '[field]';
    const type = value === null ? 'null' : Array.isArray(value) ? `array(${value.length})`
      : typeof value === 'string' ? `string(${value.length})` : typeof value;
    return `${name}:${type}`;
  }).join(', ') || '(no fields)';
}

/** VK's SDK forwards photos_list unchanged; its internal encoding is opaque. */
export function photoUploadReceipt(uploaded: Record<string, unknown>, album: number) {
  if (typeof uploaded.photos_list !== 'string') {
    throw uploadError('INVALID_UPLOAD_RESPONSE', `Upload server did not return a photos_list string; response fields: ${receiptShape(uploaded)}`);
  }
  // Reject a known empty receipt, but never parse/re-encode a signed nonempty one.
  if (!uploaded.photos_list.trim() || /^\[\s*\]$/.test(uploaded.photos_list.trim())) {
    throw uploadError('EMPTY_PHOTO_UPLOAD', 'Upload server returned an empty photos_list');
  }
  if (!Number.isSafeInteger(uploaded.server) || Number(uploaded.server) <= 0 || typeof uploaded.hash !== 'string' || !uploaded.hash) {
    throw uploadError('INVALID_UPLOAD_RESPONSE', `Upload server returned an invalid server or hash; response fields: ${receiptShape(uploaded)}`);
  }
  if (uploaded.aid !== undefined && Number(uploaded.aid) !== album) throw uploadError('INVALID_UPLOAD_RESPONSE', 'Upload receipt belongs to another album');
  return { album_id: album, server: uploaded.server, photos_list: uploaded.photos_list, hash: uploaded.hash };
}

export function uploadUrl(raw: unknown): string {
  const url = new URL(String(raw));
  if (url.protocol !== 'https:' || url.username || url.password
    || !/(^|\.)(vk\.ru|vkvideo\.ru|userapi\.com|vkuserphoto\.ru|mycdn\.me)$/.test(url.hostname)) throw new Error('INVALID_UPLOAD_SERVER');
  return url.href;
}

export function uploadFile(url: string, field: string, file: File, signal: AbortSignal, progress: (percent: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(uploadError('UPLOAD_CANCELLED')); return; }
    const xhr = new XMLHttpRequest(), form = new FormData();
    form.append(field, file, file.name);
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    const finish = () => signal.removeEventListener('abort', abort);
    xhr.open('POST', uploadUrl(url)); xhr.responseType = 'json'; xhr.timeout = 30 * 60 * 1000;
    xhr.upload.onprogress = e => { if (e.lengthComputable) progress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      finish(); const data = object(xhr.response);
      if (xhr.status < 200 || xhr.status >= 300) reject(uploadError(`HTTP_${xhr.status}`));
      else if (data.error || data.error_code) {
        const error = object(data.error);
        reject(uploadError(String(data.error_code || error.error_code || 'UPLOAD_REJECTED'),
          String(data.error_msg || error.error_msg || (typeof data.error === 'string' ? data.error : 'UPLOAD_REJECTED'))));
      }
      else if (!xhr.response) reject(uploadError('INVALID_UPLOAD_RESPONSE'));
      else resolve(xhr.response);
    };
    xhr.onerror = () => { finish(); reject(uploadError('NETWORK_ERROR')); };
    xhr.ontimeout = () => { finish(); reject(uploadError('UPLOAD_TIMEOUT')); };
    xhr.onabort = () => { finish(); reject(uploadError('UPLOAD_CANCELLED')); };
    xhr.send(form);
  });
}

/** File bytes stay in the extension page; only API metadata crosses runtime messaging. */
export async function uploadMedia(kind: 'video' | 'photo' | 'doc', file: File, album: number | null,
  call: CenterApi, signal: AbortSignal, progress: (percent: number) => void, title = '', description = '',
  onRetry: (attempt: number, total: number) => void = () => {}) {
  const check = () => { if (signal.aborted) throw new Error('UPLOAD_CANCELLED'); };
  check();
  const issue = validateUploadFiles(kind, [file])[0];
  if (issue) throw uploadError(issue.key);
  const api: CenterApi = (method, params) => uploadStep(method, () => call(method, params));
  const transfer = (url: unknown, field: string) => uploadStep('upload', () => uploadFile(uploadUrl(url), field, file, signal, progress));
  if (kind === 'video') {
    const server = object(await api('video.save', { name: title || file.name.replace(/\.[^.]+$/, ''), description,
      wallpost: 0, ...(album !== null && album > 0 ? { album_id: album } : {}) }));
    check();
    const result = object(await transfer(server.upload_url, 'video_file'));
    if (!Number(result.video_id)) throw new Error('INVALID_UPLOAD_RESPONSE');
  } else if (kind === 'doc') {
    const server = object(await api('docs.getUploadServer', {}));
    check();
    const uploaded = object(await transfer(server.upload_url, 'file'));
    check();
    if (typeof uploaded.file !== 'string' || !uploaded.file) throw new Error('INVALID_UPLOAD_RESPONSE');
    const saved = object(await api('docs.save', { file: uploaded.file, title: title || file.name, tags: description, return_tags: 1 }));
    if (!Number.isSafeInteger(object(saved.doc).id) || Number(object(saved.doc).id) <= 0) throw new Error('INVALID_SAVE_RESPONSE');
  } else {
    if (!album || album <= 0) throw new Error('ALBUM_REQUIRED');
    let receipt: ReturnType<typeof photoUploadReceipt> | undefined;
    for (let attempt = 0; attempt <= PHOTO_UPLOAD_RETRY_DELAYS.length; attempt++) {
      check();
      const server = object(await api('photos.getUploadServer', { album_id: album }));
      check();
      const uploaded = object(await transfer(server.upload_url, 'file1'));
      check();
      try {
        receipt = await uploadStep('upload', async () => photoUploadReceipt(uploaded, album));
        break;
      } catch (error) {
        // An empty receipt cannot be saved. No photos.save was sent, so a fresh
        // transfer is safe. Never retry save failures or ambiguous network errors.
        if ((error as { code?: string }).code !== 'EMPTY_PHOTO_UPLOAD') throw error;
        if (attempt === PHOTO_UPLOAD_RETRY_DELAYS.length) {
          throw Object.assign(error as Error, { message: `Upload server returned an empty photos_list after ${attempt + 1} attempts` });
        }
        onRetry(attempt + 2, PHOTO_UPLOAD_RETRY_DELAYS.length + 1);
        await bulkDelay(PHOTO_UPLOAD_RETRY_DELAYS[attempt], signal);
        check(); progress(0);
      }
    }
    if (!receipt) throw uploadError('INVALID_UPLOAD_RESPONSE');
    check();
    const saved = await api('photos.save', { ...receipt, caption: description });
    if (!Array.isArray(saved) || !saved.length || !Number(object(saved[0]).id)) throw new Error('INVALID_SAVE_RESPONSE');
  }
}
