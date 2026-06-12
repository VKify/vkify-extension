/**
 * Схлопывание частых вызовов в один на кадр.
 *
 * MutationObserver на `document.body` с `subtree: true` дёргает колбэк на каждый
 * батч мутаций — на ленте/диалогах VK это десятки раз в секунду. Если колбэк
 * делает идемпотентный `scan()` (querySelector + вставка кнопок, когда их ещё
 * нет), достаточно выполнить его один раз за кадр: лишние проходы по DOM ничего
 * не меняют, но стоят CPU.
 *
 * Обёртка откладывает вызов до следующего animation frame и игнорирует
 * повторные вызовы, пока кадр не наступил. `requestAnimationFrame` к тому же не
 * срабатывает в фоновой вкладке — на скрытой странице кнопки качать незачем.
 */
export function coalesceFrame(fn: () => void): (() => void) & { cancel: () => void } {
  let handle = 0;

  const run = (): void => {
    handle = 0;
    fn();
  };

  const wrapped = (): void => {
    if (handle) return;
    handle = requestAnimationFrame(run);
  };

  wrapped.cancel = (): void => {
    if (handle) {
      cancelAnimationFrame(handle);
      handle = 0;
    }
  };

  return wrapped;
}
