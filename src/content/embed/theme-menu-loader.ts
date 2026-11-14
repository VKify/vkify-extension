import { domObserver } from '@/content/core/dom/dom-observer.js';

/** Keep profiles, palette data and validators off the document-start path. */
export function startThemeMenuLoader(): () => void {
  let loaded = false;
  let active = true;
  let pending: Promise<void> | null = null;
  const load = (): void => {
    if (!active || loaded || pending) return;
    pending = Promise.resolve().then(() => chrome.runtime.sendMessage({ type: 'INJECT_THEME_MENU' })).then((result: { ok?: boolean }) => {
      loaded = result?.ok === true;
      if (loaded) cleanup();
    }).catch(() => { /* Retry on the next profile-menu opening. */ }).finally(() => { pending = null; });
  };
  const stop = domObserver.observeMatches('[data-testid="header-profile-menu"]', load);
  // A keep-mounted profile menu may be opened repeatedly without a new node.
  const click = (event: MouseEvent): void => {
    if (event.target instanceof Element && event.target.closest('[data-testid="header-profile-menu-button"]')) load();
  };
  document.addEventListener('click', click, true);
  function cleanup(): void { active = false; stop(); document.removeEventListener('click', click, true); }
  return cleanup;
}
