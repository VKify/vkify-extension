import type { FeatureContext } from '@/content/core/feature-context.js';
import { t } from '@/content/i18n/index.js';

const ROOT = '[data-testid="video_page_playlist_videos"]';

export function createPlaylistCollapse(ctx: FeatureContext) {
  const tracked = new Map<HTMLElement, { button: HTMLButtonElement; heading: Element }>();
  let off: (() => void) | undefined;
  const cleanup = (root: HTMLElement): void => {
    const entry = tracked.get(root);
    entry?.button.remove();
    entry?.heading.removeAttribute('data-vkify-playlist-heading');
    root.removeAttribute('data-vkify-playlist-collapsed');
    tracked.delete(root);
  };
  const sync = (): void => {
    for (const [root, entry] of tracked) {
      if (!root.isConnected || !root.contains(entry.button) || !root.contains(entry.heading)) cleanup(root);
    }
    for (const root of document.querySelectorAll<HTMLElement>(ROOT)) {
      if (tracked.has(root)) continue;
      const link = root.querySelector('a[href^="/playlist/"], a[href^="https://vkvideo.ru/playlist/"]');
      const heading = Array.from(root.children).find(child => link && child.contains(link));
      // Fail closed if VK changes the panel: never guess by hashed classes.
      if (!heading) continue;
      root.querySelectorAll('[data-vkify-playlist-toggle]').forEach(button => button.remove());
      heading.setAttribute('data-vkify-playlist-heading', '');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-vkify-playlist-toggle', '');
      root.setAttribute('data-vkify-playlist-collapsed', '');
      const update = (): void => {
        const collapsed = root.hasAttribute('data-vkify-playlist-collapsed');
        button.setAttribute('aria-expanded', String(!collapsed));
        button.textContent = t(collapsed ? 'video_hiding.expand_playlist' : 'video_hiding.collapse_playlist');
      };
      button.onclick = () => { root.toggleAttribute('data-vkify-playlist-collapsed'); update(); };
      update();
      root.append(button);
      tracked.set(root, { button, heading });
    }
  };
  return {
    reapplyOnLanguageChange: true,
    enable: (): void => { if (!off) off = ctx.observeChanges('collapse_video_playlist', sync); sync(); },
    disable: (): void => { off?.(); off = undefined; for (const root of tracked.keys()) cleanup(root); },
  };
}
