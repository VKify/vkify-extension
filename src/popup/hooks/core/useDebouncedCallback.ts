import { useRef, useEffect, useCallback } from 'react';

/**
 * Возвращает дебаунснутую обёртку над `callback`: вызов откладывается на `delay`
 * мс и перезапускается при каждом новом обращении. До таймаута сохраняются
 * только последние аргументы — наружу уходит ровно одно (хвостовое) срабатывание
 * после паузы.
 *
 * Зачем: выбор цвета (перетаскивание ползунка/пипетка) шлёт `input` лавиной по
 * мере перемещения курсора. Без дебаунса каждое промежуточное значение писалось
 * бы в chrome.storage и тут же применялось контент-скриптом — отсюда «глюки» темы.
 * UI остаётся отзывчивым через локальный стейт, а в storage летит только итог.
 *
 * Незавершённый вызов флашится при размонтировании, чтобы выбранный цвет не
 * потерялся, если попап закрыли быстрее, чем истёк `delay`.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<A | null>(null);

  const fire = useCallback((): void => {
    timerRef.current = null;
    if (lastArgsRef.current) {
      const args = lastArgsRef.current;
      lastArgsRef.current = null;
      callbackRef.current(...args);
    }
  }, []);

  useEffect(() => {
    // Флашим хвост на размонтировании: иначе последний цвет потеряется.
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        fire();
      }
    };
  }, [fire]);

  return useCallback((...args: A): void => {
    lastArgsRef.current = args;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fire, delay);
  }, [delay, fire]);
}
