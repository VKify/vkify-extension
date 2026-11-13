import { dispatchPageEvent } from './page-event.js';
/**
 * Ждёт, пока инжектированный скрипт не сигнализирует о готовности
 * через событие `vkify-script-ready`.
 *
 * Используется вместо setTimeout/requestAnimationFrame: скрипт сам сообщает,
 * когда его обработчики зарегистрированы и можно безопасно отправлять события.
 */
import { PROTECTION_SCRIPTS, type InjectedScriptName } from '../core/injected-scripts.js';

const readyScripts = new Set<InjectedScriptName>();
// These interceptors stay installed for the document lifetime, including SPA navigation.
const persistentScripts = PROTECTION_SCRIPTS;
if (typeof window !== 'undefined') {
  window.addEventListener('vkify-script-ready', (event: Event) => {
    const name = (event as CustomEvent).detail?.name;
    if (persistentScripts.includes(name)) readyScripts.add(name);
  });
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source === window && event.data?.type === 'VKIFY_DESTROY') readyScripts.clear();
  });
}

export function waitForInjectedScript(name: InjectedScriptName, timeoutMs = 3000): Promise<void> {
  if (readyScripts.has(name)) return Promise.resolve();
  return new Promise(resolve => {
    const handler = (event: Event) => {
      if ((event as CustomEvent).detail?.name !== name) return;
      window.removeEventListener('vkify-script-ready', handler);
      clearTimeout(timer);
      resolve();
    };

    window.addEventListener('vkify-script-ready', handler);

    // Фолбэк: если скрипт уже загрузился до того, как мы начали слушать,
    // или что-то пошло не так — просто продолжаем через таймаут.
    const timer = setTimeout(() => {
      window.removeEventListener('vkify-script-ready', handler);
      resolve();
    }, timeoutMs);
    // An already-loaded equalizer answers immediately; no per-feature 3s fallback.
    if (name === 'equalizer') dispatchPageEvent('vkify:equalizer:ping');
    if (persistentScripts.includes(name)) dispatchPageEvent('vkify:script:ping', { name });
  });
}
