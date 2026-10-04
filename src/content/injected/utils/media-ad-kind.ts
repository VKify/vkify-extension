export type MediaAdKind = 'audio' | 'video';

/** Match actual hostnames, never a domain mentioned in a query or suffix spoof. */
export function isMediaAdUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value, location.href);
    return ['ad.mail.ru', 'mradx.net'].some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

export function mediaAdContext(): MediaAdKind {
  if (location.hostname === 'vkvideo.ru' || location.hostname.endsWith('.vkvideo.ru')
    || /^\/video(?:-|\d|\/|$)/.test(location.pathname)
    || new URLSearchParams(location.search).get('z')?.startsWith('video')
    || Array.from(document.querySelectorAll('#video_layer, #mv_box, .VideoLayer'))
      .some(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden')) return 'video';
  return 'audio';
}
