/** Reply to extension UI only after the actual page transition has finished. */
export function createWallpaperRenderStatus() {
  let current = { url: '', phase: 'idle' };
  const waiting = new Set<(value: typeof current) => void>();
  const update = (url: string, phase: string) => {
    current = { url, phase };
    for (const notify of waiting) notify(current);
  };
  if (typeof chrome !== 'undefined') chrome.runtime?.onMessage?.addListener((message, _sender, respond) => {
    if (message?.type !== 'WAIT_WALLPAPER_RENDER' || typeof message.url !== 'string') return;
    const notify = (state: typeof current) => {
      if (state.url !== message.url || !['ready', 'error'].includes(state.phase)) return;
      clearTimeout(timer); waiting.delete(notify); respond({ ready: state.phase === 'ready' });
    };
    const timer = setTimeout(() => { waiting.delete(notify); respond({ ready: false }); }, 20000);
    waiting.add(notify); notify(current);
    return true;
  });
  return update;
}
