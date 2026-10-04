import { isMediaAdUrl } from './media-ad-kind.js';
import { queryShadowAll } from '@/content/utils/video-player.js';

/** Only finish an already-loaded advertising video, never the main player. */
export function finishLoadedVideoAds(report: (url: string) => void): void {
  const selector = '[data-testid="ad-container"] video';
  const ads = Array.from(document.querySelectorAll<HTMLVideoElement>(selector));
  // VK uses these hosts; avoid walking the whole feed every second.
  for (const host of document.querySelectorAll('.shadow-root-container')) {
    if (host.shadowRoot) ads.push(...queryShadowAll<HTMLVideoElement>(selector, host.shadowRoot));
  }
  for (const media of ads) {
    if (media.closest('[data-testid="ad-container"]')?.parentElement?.classList.contains('hidden')) continue;
    const url = media.currentSrc || media.src;
    if (!isMediaAdUrl(url) || !Number.isFinite(media.duration) || media.duration <= 0
      || media.ended || media.currentTime >= media.duration) continue;
    try {
      media.currentTime = media.duration;
      report(url);
    } catch { /* Not seekable yet; retry after metadata arrives. */ }
  }
}
