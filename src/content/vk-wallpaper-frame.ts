/** Runs only inside marked wallpaper embeds, never in the regular VK player. */
export function startVkWallpaperFrame(): (() => void) | null {
  if (window.parent === window || new URL(location.href).searchParams.get('vkify_wallpaper') !== '1') return null;
  const curtain = document.createElement('style');
  curtain.textContent = 'html { visibility:hidden !important; }';
  (document.head ?? document.documentElement).append(curtain);
  const roots = new Set<Document | ShadowRoot>([document]);
  const observers: MutationObserver[] = [];
  const videos = new WeakSet<HTMLVideoElement>();
  let disposed = false;
  let announced = false;
  const resume = (video: HTMLVideoElement) => {
    video.loop = true;
    if (!document.hidden && video.paused) void video.play().catch(() => {});
  };
  function scan(): void {
    if (disposed) return;
    for (const root of roots) {
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot && !roots.has(element.shadowRoot)) {
          roots.add(element.shadowRoot); observe(element.shadowRoot);
        }
      }
      for (const video of root.querySelectorAll('video')) {
        // Keep only the media branch. Recommendations and controls can be
        // mounted in either the document or the player's open Shadow DOM.
        let branch: Element = video;
        while (branch !== document.body && branch !== document.documentElement) {
          const parent = branch.parentElement;
          const owner = branch.getRootNode();
          const siblings = parent?.children ?? (owner instanceof ShadowRoot ? owner.children : []);
          for (const sibling of siblings) {
            if (sibling === branch || /^(STYLE|SCRIPT|LINK)$/.test(sibling.tagName)) continue;
            const style = (sibling as HTMLElement).style;
            if (style && (style.display !== 'none' || style.getPropertyPriority('display') !== 'important')) style.setProperty('display', 'none', 'important');
          }
          if (parent) branch = parent;
          else if (owner instanceof ShadowRoot) branch = owner.host;
          else break;
        }
        if (!videos.has(video)) {
          videos.add(video);
          video.addEventListener('ended', () => { if (!disposed) { video.currentTime = 0; resume(video); } });
        }
        resume(video);
        curtain.remove();
        if (!announced) {
          announced = true;
          window.parent.postMessage({ type:'VKIFY_WALLPAPER_READY' }, '*');
        }
      }
    }
  }
  function observe(root: Document | ShadowRoot): void {
    const observer = new MutationObserver(scan);
    observer.observe(root, { childList:true, subtree:true });
    observers.push(observer);
  }
  observe(document);
  // attachShadow itself is not a DOM mutation; handle hosts attached before it.
  const timer = setInterval(scan, 250);
  document.addEventListener('visibilitychange', scan);
  scan();
  return () => { disposed = true; clearInterval(timer); observers.forEach(o => o.disconnect()); document.removeEventListener('visibilitychange', scan); curtain.remove(); };
}

startVkWallpaperFrame();
