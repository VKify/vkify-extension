import { LOGO_IMAGE_TYPES, MAX_LOGO_FILE_SIZE } from './custom-logo.js';

/** Enforce the size limit on decoded response bytes, even without Content-Length. */
export async function readLogoResponse(response: Response): Promise<Blob> {
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!response.ok || !LOGO_IMAGE_TYPES.includes(type) || Number(response.headers.get('content-length')) > MAX_LOGO_FILE_SIZE || !response.body) {
    await response.body?.cancel();
    throw new Error('Invalid logo response');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_LOGO_FILE_SIZE) throw new Error('Logo exceeds size limit');
      chunks.push(new Uint8Array(value));
    }
    if (!size) throw new Error('Empty logo');
    return new Blob(chunks, { type });
  } finally {
    try { await reader.cancel(); } catch { /* network aborted */ }
    reader.releaseLock();
  }
}
