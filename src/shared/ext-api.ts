/**
 * Кросс-браузерная нормализация WebExtensions API.
 *
 * Проблема: код расширения вызывает `chrome.*` в promise-стиле
 * (`await chrome.storage.local.get(...)`). Это работает нативно в Chromium
 * (Chrome / Opera, MV3), но в Firefox promise-API живёт только на `browser.*`,
 * а `chrome.*` остаётся callback-only — `await` над ним зависает/ломается.
 *
 * Почему НЕ webextension-polyfill: его обёртка над `runtime.onMessage` меняет
 * семантику и НЕ поддерживает паттерн `return true` + `sendResponse`, который
 * активно используется в этом проекте (см. content/services/message-service.ts
 * и background/handlers/message-handler.ts). Полифилл потребовал бы переписать
 * все слушатели на возврат Promise — лишний риск регрессий.
 *
 * Решение: оба НАТИВНЫХ объекта уже умеют всё, что нужно коду —
 *   • `browser.*` (Firefox) — promise-методы + `return true`/`sendResponse`;
 *   • `chrome.*`  (Chromium MV3) — то же самое.
 * Несовместимо только ИМЯ. Поэтому на Firefox мы просто указываем глобальный
 * `chrome` на нативный `browser`. На Chromium `browser` отсутствует — ничего не
 * меняем, поведение идентично прежнему (фактически no-op).
 *
 * Этот модуль импортируется ПЕРВЫМ (side-effect) в каждой точке входа,
 * выполняющейся в extension-контексте: background, content, embed, site-bridge,
 * popup. НЕ импортируется в injected/* — те исполняются в page-world и не имеют
 * доступа к расширенческому API вовсе.
 */

type ChromeApi = typeof chrome;

interface ExtGlobal {
  chrome?: ChromeApi;
  browser?: ChromeApi;
  __vkifyApi?: ChromeApi;
}

/**
 * Устанавливает кросс-браузерную нормализацию и возвращает нормализованный API.
 *
 * Вызывается явно первой строкой каждой точки входа. Это намеренно функция, а
 * не «голый» side-effect модуля: side-effect-only импорт Rollup/esbuild может
 * вырезать как мёртвый код при tree-shaking ES-бандла (background); явный вызов
 * сохраняется всегда.
 */
export function installExtApi(): ChromeApi {
  const g = globalThis as unknown as ExtGlobal;

  // Firefox: есть промис-ориентированный `browser`, отличный от callback-`chrome`.
  if (g.browser?.runtime && g.browser !== g.chrome) {
    try {
      g.chrome = g.browser;
    } catch {
      // На случай, если в каком-то движке глобальный `chrome` окажется
      // read-only: код, которому нужны промисы, может импортировать { api }.
      // (На сегодня Chrome/Opera/Firefox разрешают переприсваивание.)
    }
  }

  const resolved = (g.browser?.runtime ? g.browser : g.chrome) as ChromeApi;

  // Безусловная запись в globalThis. Помимо удобной ссылки, это делает функцию
  // заведомо «нечистой» (наблюдаемая мутация глобала), из-за чего Rollup/esbuild
  // не имеют права вырезать её вызов при tree-shaking ES-бандла (popup/background).
  g.__vkifyApi = resolved;
  return resolved;
}

/**
 * Нормализованный API. Существующий код пользуется глобальным `chrome`
 * (переопределённым в installExtApi), но новый код может импортировать `api`,
 * чтобы не зависеть от переопределения глобала.
 */
export const api: ChromeApi = installExtApi();
