/** VK Video's player and ad-container live in an open shadow root. */
export function queryShadowAll<T extends Element>(selector: string, root: ParentNode = document): T[] {
  const found = Array.from(root.querySelectorAll<T>(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) found.push(...queryShadowAll<T>(selector, element.shadowRoot));
  }
  return found;
}

export function isVisible(element: Element): boolean {
  return element.getClientRects().length > 0
    && getComputedStyle(element).visibility !== 'hidden';
}

export function getVideoPlayer(): { region: HTMLElement; media: HTMLVideoElement } | null {
  const players = queryShadowAll<HTMLElement>('[role="region"][aria-label="Видеоплеер"], [role="region"][aria-label="Video player"]');
  // Prefer the focused player, then a playing player, then the visible player.
  const candidates = players.filter(isVisible).map(region => ({
    region, media: region.querySelector<HTMLVideoElement>('[data-testid="video-container"] video, video.player-media'),
  })).filter((p): p is { region: HTMLElement; media: HTMLVideoElement } => !!p.media);
  return candidates.find(p => p.region.matches(':focus-within'))
    ?? candidates.find(p => !p.media.paused) ?? candidates[0] ?? null;
}
