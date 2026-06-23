/**
 * Доступ к `performance.memory` (heap size) с честной деградацией.
 *
 * `performance.memory` — нестандартное расширение Chromium: есть в content,
 * popup и service worker на Chrome/Opera, отсутствует в Firefox. Поэтому поля
 * опциональны, а вызывающая сторона показывает «н/д», когда heap недоступен.
 */

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface HeapInfo {
  usedBytes?: number;
  totalBytes?: number;
  limitBytes?: number;
}

export function readHeap(): HeapInfo {
  try {
    const mem = (performance as Performance & { memory?: PerformanceMemory }).memory;
    if (!mem) return {};
    return {
      usedBytes: mem.usedJSHeapSize,
      totalBytes: mem.totalJSHeapSize,
      limitBytes: mem.jsHeapSizeLimit,
    };
  } catch {
    return {};
  }
}
