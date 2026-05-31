/**
 * Целевой браузер сборки — подставляется Vite `define` (`__VKIFY_BROWSER__`)
 * во все бандлы (popup, background, classic, injected). Единый источник истины
 * для точечных расхождений поведения между движками.
 *
 * Значения: 'chrome' | 'firefox' | 'opera'. По умолчанию (вне сборки, напр. в
 * тестах) — 'chrome'.
 *
 * Использовать ТОЛЬКО для настоящих API-различий движков (напр. строгая
 * валидация схем в Firefox), а не как замену рантайм-детекту фич там, где она
 * уместнее. Chrome и Opera идентичны (Chromium), поэтому проверяем обычно
 * `IS_FIREFOX`.
 */

// Defined by Vite (see vite.config.ts → `define`). Always present in built
// artifacts; the runtime fallback covers the test environment.
declare const __VKIFY_BROWSER__: string;

function resolveBrowser(): 'chrome' | 'firefox' | 'opera' {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof __VKIFY_BROWSER__ === 'string' && __VKIFY_BROWSER__) {
      return __VKIFY_BROWSER__ as 'chrome' | 'firefox' | 'opera';
    }
  } catch { /* ReferenceError outside the build */ }
  return 'chrome';
}

export const BROWSER = resolveBrowser();

/** Gecko-движок: строгая валидация схем API, event-page вместо service worker и т.п. */
export const IS_FIREFOX = BROWSER === 'firefox';

/** Chromium (Chrome / Opera). */
export const IS_CHROMIUM = !IS_FIREFOX;
