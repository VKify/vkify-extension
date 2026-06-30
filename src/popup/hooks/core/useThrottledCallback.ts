import { useRef, useEffect, useCallback } from 'react';

/**
 * Возвращает throttle-обёртку над `callback`: вызовы проходят не чаще, чем раз в
 * `interval` мс (передний фронт сразу + хвостовой вызов с последними аргументами).
 *
 * В отличие от useDebouncedCallback (только хвост — эффект виден лишь после паузы),
 * throttle применяет значение НЕПРЕРЫВНО во время перетаскивания. Нужен там, где у
 * цвета нет канала мгновенного preview и единственный путь применения — запись в
 * storage: дебаунс делал бы вид «цвет применяется слишком долго», а без троттла
 * перетаскивание писало бы в chrome.storage десятки раз в секунду.
 *
 * Незавершённый хвост флашится при размонтировании, чтобы итоговое значение не
 * потерялось при быстром закрытии попапа.
 */
export function useThrottledCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  interval: number,
): (...args: A) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const lastRunRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<A | null>(null);

  const run = useCallback((): void => {
    lastRunRef.current = Date.now();
    timerRef.current = null;
    if (lastArgsRef.current) {
      const args = lastArgsRef.current;
      lastArgsRef.current = null;
      callbackRef.current(...args);
    }
  }, []);

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      run();
    }
  }, [run]);

  return useCallback((...args: A): void => {
    lastArgsRef.current = args;
    const elapsed = Date.now() - lastRunRef.current;
    if (elapsed >= interval) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      run();
    } else if (timerRef.current == null) {
      timerRef.current = setTimeout(run, interval - elapsed);
    }
  }, [interval, run]);
}
