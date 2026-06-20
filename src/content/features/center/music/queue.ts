/**
 * Очередь загрузок (семафор). Ограничивает число одновременных конвейеров
 * HLS→MP3 до MAX_CONCURRENT — остальные ждут свободный слот.
 */

import { MAX_CONCURRENT } from './constants.js';

let activeDownloads = 0;
const waitQueue: Array<() => void> = [];

/** Текущее число активных загрузок (для подписи «В очереди»). */
export function activeCount(): number {
  return activeDownloads;
}

/** Ждёт свободный слот. Резолвится сразу, если активных < лимита. */
export function acquireSlot(): Promise<void> {
  if (activeDownloads < MAX_CONCURRENT) {
    activeDownloads++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waitQueue.push(resolve));
}

/** Освобождает слот: передаёт его следующему в очереди либо уменьшает счётчик. */
export function releaseSlot(): void {
  const next = waitQueue.shift();
  if (next) next();
  else activeDownloads = Math.max(0, activeDownloads - 1);
}

/** Полный сброс очереди (при выключении фичи). */
export function resetQueue(): void {
  activeDownloads = 0;
  waitQueue.length = 0;
}
