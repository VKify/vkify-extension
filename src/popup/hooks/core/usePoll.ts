import { useEffect } from 'react';

/**
 * Вызывает `callback` сразу при монтировании и затем каждые `intervalMs`.
 *
 * Единая точка для popup-поллинга состояния, которое пишется вне React
 * (фоновые трекеры в chrome.storage). `callback` должен быть стабильным
 * (обёрнут в useCallback) — он входит в зависимости эффекта.
 */
export function usePoll(callback: () => void, intervalMs: number): void {
  useEffect(() => {
    callback();
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  }, [callback, intervalMs]);
}
