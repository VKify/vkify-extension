import type { CenterApi } from './center-tools.js';
import { object } from './center-tools.js';

export function uploadUrl(raw: unknown): string {
  const url = new URL(String(raw));
  if (url.protocol !== 'https:' || url.username || url.password
    || !/(^|\.)(vk\.ru|vkvideo\.ru|userapi\.com|vkuserphoto\.ru|mycdn\.me)$/.test(url.hostname)) throw new Error('INVALID_UPLOAD_SERVER');
  return url.href;
}

export function uploadFile(url: string, field: string, file: File, signal: AbortSignal, progress: (percent: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('UPLOAD_CANCELLED')); return; }
    const xhr = new XMLHttpRequest(), form = new FormData();
    form.append(field, file, file.name);
    const abort = () => xhr.abort();
    signal.addEventListener('abort', abort, { once: true });
    const finish = () => signal.removeEventListener('abort', abort);
    xhr.open('POST', uploadUrl(url)); xhr.responseType = 'json'; xhr.timeout = 30 * 60 * 1000;
    xhr.upload.onprogress = e => { if (e.lengthComputable) progress(Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => {
      finish(); const data = object(xhr.response);
      if (xhr.status < 200 || xhr.status >= 300 || !xhr.response || data.error || data.error_code) reject(new Error('UPLOAD_FAILED'));
      else resolve(xhr.response);
    };
    xhr.onerror = xhr.ontimeout = () => { finish(); reject(new Error('UPLOAD_FAILED')); };
    xhr.onabort = () => { finish(); reject(new Error('UPLOAD_CANCELLED')); };
    xhr.send(form);
  });
}

/** File bytes stay in the extension page; only API metadata crosses runtime messaging. */
export async function uploadMedia(kind: 'video' | 'photo', file: File, album: number | null,
  call: CenterApi, signal: AbortSignal, progress: (percent: number) => void, title = '', description = '') {
  const check = () => { if (signal.aborted) throw new Error('UPLOAD_CANCELLED'); };
  check();
  if (kind === 'video') {
    const server = object(await call('video.save', { name: title || file.name.replace(/\.[^.]+$/, ''), description,
      wallpost: 0, ...(album !== null && album > 0 ? { album_id: album } : {}) }));
    check();
    const result = object(await uploadFile(uploadUrl(server.upload_url), 'video_file', file, signal, progress));
    if (!Number(result.video_id)) throw new Error('INVALID_UPLOAD_RESPONSE');
  } else {
    if (!album || album <= 0) throw new Error('ALBUM_REQUIRED');
    const server = object(await call('photos.getUploadServer', { album_id: album }));
    check();
    const uploaded = object(await uploadFile(uploadUrl(server.upload_url), 'file1', file, signal, progress));
    check();
    if (!uploaded.server || typeof uploaded.photos_list !== 'string' || uploaded.photos_list === '[]' || typeof uploaded.hash !== 'string') throw new Error('INVALID_UPLOAD_RESPONSE');
    const saved = await call('photos.save', { album_id: album, server: uploaded.server, photos_list: uploaded.photos_list, hash: uploaded.hash, caption: description });
    if (!Array.isArray(saved) || !saved.length || !Number(object(saved[0]).id)) throw new Error('INVALID_SAVE_RESPONSE');
  }
}
