import { object } from '../center-tools.js';

export function isVkPhotoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
      ['userapi.com', 'userapi.ru', 'vkuserphoto.ru', 'vk.ru', 'vk.com'].some(host => url.hostname === host || url.hostname.endsWith('.' + host));
  } catch { return false; }
}

/** Use one largest accessible image per photo attachment; never forwarded media. */
export function messagePhotos(raw: unknown): string[] {
  const attachments = object(raw).attachments;
  if (!Array.isArray(attachments)) return [];
  const urls: string[] = [];
  for (const attachment of attachments) {
    const a = object(attachment);
    if (a.type !== 'photo') continue;
    const sizes = object(a.photo).sizes;
    if (!Array.isArray(sizes)) continue;
    const largest = sizes.map(object).filter(s => isVkPhotoUrl(s.url))
      .sort((a, b) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0))[0];
    if (largest && !urls.includes(String(largest.url))) urls.push(String(largest.url));
    if (urls.length === 10) break;
  }
  return urls;
}
