import { fetchBytesLimited } from '../utils/audio-cdn.js';
import { bytesToBase64 } from '../utils/base64.js';
import { isBackgroundSource } from '../../shared/background-source.js';
export async function fetchBackgroundImage(url: string): Promise<{ success: true; dataUrl: string } | { success: false; error: string }> {
  if (!isBackgroundSource(url) || !url.startsWith('https:')) return { success: false, error: 'Background image could not be loaded' };
  try {
    const { response, bytes } = await fetchBytesLimited(url, 5 * 1024 * 1024, { credentials: 'omit', referrerPolicy: 'no-referrer' }, 10000);
    const mime = response.headers.get('content-type')?.split(';')[0];
    if (!bytes.byteLength || !mime || !/^image\/(png|jpeg|jpg|gif|webp|avif|bmp)$/.test(mime)) return { success: false, error: 'Background image could not be loaded' };
    return { success: true, dataUrl: 'data:' + mime + ';base64,' + bytesToBase64(bytes) };
  } catch { return { success: false, error: 'Background image could not be loaded' }; }
}
