/**
 * Ждёт, пока инжектированный скрипт не сигнализирует о готовности
 * через событие `vkify-script-ready`.
 *
 * Используется вместо setTimeout/requestAnimationFrame: скрипт сам сообщает,
 * когда его обработчики зарегистрированы и можно безопасно отправлять события.
 */
import type { InjectedScriptName } from '../core/injected-scripts.js';

export function waitForInjectedScript(name: InjectedScriptName, timeoutMs = 3000): Promise<void> {
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
  });
}