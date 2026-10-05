import type { CenterApi } from './center-tools.js';
import { bulkDelay } from './bulk-actions.js';

export type UploadKind = 'photo' | 'video' | 'doc';
/** VKify's local queue limits, not a promise about VK account/server quotas. */
export const UPLOAD_LIMITS = {
  photo: { files: 10, bytes: 20 * 1024 ** 2, extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
  video: { files: 3, bytes: 2 * 1024 ** 3, extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'mpeg', 'mpg', '3gp', 'wmv', 'flv', 'ts'] },
  doc: { files: 10, bytes: 200 * 1024 ** 2, extensions: [] as string[] },
} satisfies Record<UploadKind, { files: number; bytes: number; extensions: string[] }>;
export const UPLOAD_FILE_DELAY_MS = 3000;
export const UPLOAD_API_DELAY_MS = 1100;
export type UploadIssue = { key: 'too_many' | 'too_large' | 'empty_file' | 'unsupported'; name?: string };

export function validateUploadFiles(kind: UploadKind, files: readonly Pick<File, 'name' | 'size' | 'type'>[]): UploadIssue[] {
  const limits = UPLOAD_LIMITS[kind], issues: UploadIssue[] = [];
  if (files.length > limits.files) issues.push({ key: 'too_many' });
  for (const file of files) {
    if (!file.size) issues.push({ key: 'empty_file', name: file.name });
    else if (file.size > limits.bytes) issues.push({ key: 'too_large', name: file.name });
    if (kind !== 'doc') {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const mime = file.type.toLowerCase();
      const genericMime = !mime || mime === 'application/octet-stream';
      const validMime = kind === 'photo' ? /^image\/(jpeg|png|gif|webp)$/.test(mime) : mime.startsWith('video/');
      if (!limits.extensions.includes(extension) || (!genericMime && !validMime)) issues.push({ key: 'unsupported', name: file.name });
    }
  }
  return issues;
}

// Retained across form remounts: a cancelled form may still have an API call in flight.
let lastApiCompleted = 0;
export function pacedUploadApi(call: CenterApi, signal: AbortSignal, waiting: () => void): CenterApi {
  return async (method, params) => {
    const delay = Math.max(0, UPLOAD_API_DELAY_MS - (Date.now() - lastApiCompleted));
    if (delay) { waiting(); await bulkDelay(delay, signal); }
    if (signal.aborted) throw Object.assign(new Error('UPLOAD_CANCELLED'), { code: 'UPLOAD_CANCELLED' });
    try { return await call(method, params); }
    finally { lastApiCompleted = Date.now(); }
  };
}

export function uploadErrorReason(error: unknown): string {
  const err = error as { code?: unknown; message?: string };
  const code = String(err?.code || err?.message || '');
  if (['6', '9', '29'].includes(code)) return 'rate_limit';
  if (code === '14') return 'captcha';
  if (['5', '7', '15', '200', '201', '203', 'no_token', 'no_vk_tab', 'expired', 'TOKEN_EXPIRED'].includes(code)) return 'access';
  if (code === 'ACCOUNT_CHANGED') return 'account_changed';
  if (code === 'UPLOAD_CANCELLED') return 'cancelled';
  if (['NETWORK_ERROR', 'UPLOAD_TIMEOUT'].includes(code)) return 'network';
  if (['100', '114', '118', '119', '121', '122', '129'].includes(code)) return 'invalid_parameter';
  if (code === 'EMPTY_PHOTO_UPLOAD') return 'empty_photo';
  if (['UPLOAD_REJECTED', '22', 'HTTP_413', '270', '271'].includes(code)) return 'file_rejected';
  if (code === 'INVALID_UPLOAD_RESPONSE') return 'invalid_receipt';
  return 'unknown';
}

export function uploadErrorDetails(error: unknown): string {
  const err = error as { code?: unknown; message?: string; method?: string };
  const code = String(err?.code || '');
  // Never display signed upload URLs or credentials from server diagnostics.
  const message = String(err?.message || '').replace(/https?:\/\/\S+/g, '[URL]')
    .replace(/\b(access_token|hash|file|photos_list)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 500);
  return [err?.method, code ? `(${code})` : '', message !== code ? message : ''].filter(Boolean).join(': ');
}
