import { domObserver } from '@/content/core/dom/dom-observer.js';
import { PROFILE_MENU_SELECTOR } from './profile-menu-dom.js';

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
  const stop = domObserver.observeMatches(PROFILE_MENU_SELECTOR, load);
  // A keep-mounted profile menu may be opened repeatedly without a new node.
  const click = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) return;
    const headerLink = event.target.closest('#page_header a');
    if (event.target.closest(PROFILE_MENU_SELECTOR)
      || (headerLink && /Настройки профиля|Profile settings/i.test(headerLink.textContent ?? ''))) load();
  };
  document.addEventListener('click', click, true);
  function cleanup(): void { active = false; stop(); document.removeEventListener('click', click, true); }
  return cleanup;
}
