/** The player/API URL is data, never markup or a script-capable resource. */
export function musicArtworkUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function tupleArtwork(tuple: unknown[]): string {
  if (typeof tuple[14] !== 'string') return '';
  const urls = tuple[14].split(',').map(value => musicArtworkUrl(value.trim())).filter(Boolean);
  return urls[urls.length - 1] ?? '';
}

export function apiArtwork(response: unknown, trackId: string): string {
  const data = response as { response?: unknown; items?: unknown } | null;
  const raw = data?.response ?? response;
  const items = Array.isArray(raw) ? raw : (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return '';
  const track = items.find(item => item && `${item.owner_id}_${item.id}` === trackId);
  const thumb = track?.album?.thumb ?? track?.thumb;
  if (!thumb || typeof thumb !== 'object') return '';
  for (const key of ['photo_1200', 'photo_600', 'photo_300', 'photo_270', 'photo_135', 'photo_68']) {
    const url = musicArtworkUrl(thumb[key]);
    if (url) return url;
  }
  return '';
}
