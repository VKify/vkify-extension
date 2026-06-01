/**
 * Отправка CustomEvent из CONTENT-скрипта в MAIN-world страницы, где слушают
 * инжектированные скрипты (src/content/injected/*).
 *
 * КРОСС-БРАУЗЕРНО (главное отличие Firefox):
 *   Chromium держит content-скрипт и страницу в одном JS-мире — объект `detail`
 *   виден обеим сторонам, обычный dispatch работает.
 *   Firefox изолирует миры: объект, созданный в песочнице content-скрипта, НЕ
 *   виден скриптам страницы, поэтому на стороне injected `event.detail`
 *   прочитается как `undefined` — и команды (vkify-update-settings,
 *   vkify-spy-control, vkify:player:action) просто не доходят, фичи не включаются.
 *   `cloneInto` (глобал, доступный только в content-скриптах Firefox) пере-создаёт
 *   объект внутри компартмента страницы, и injected-слушатель его читает.
 *
 * Обратное направление (injected → content) в фиксе не нуждается: content-скрипт
 * имеет Xray-доступ на ЧТЕНИЕ объектов страницы.
 */

type CloneInto = <T>(obj: T, targetScope: unknown, options?: { cloneFunctions?: boolean }) => T;

export function dispatchPageEvent(name: string, detail: Record<string, unknown> = {}): void {
  let payload: Record<string, unknown> = detail;

  const cloneInto = (globalThis as { cloneInto?: CloneInto }).cloneInto;
  if (typeof cloneInto === 'function') {
    try {
      payload = cloneInto(detail, window);
    } catch {
      // Если клонирование не удалось (напр. неклонируемое значение) — шлём как
      // есть; на Chromium сюда не попадаем вовсе.
    }
  }

  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
}
