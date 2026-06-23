/**
 * Сборщик телеметрии производительности в content-скрипте.
 *
 * Дёшево по дизайну: счётчики только инкрементятся в горячих точках
 * (enable фичи, DOM-колбэк, API-вызов). Никаких таймеров в простое — снимок
 * (`PerfSnapshot.context`) строится лениво в message-service только когда popup
 * открыт на дашборде или мини-виджет шлёт GET_PERF_TELEMETRY. Флаши общего
 * observer'а считает сам domObserver (getFlushCount), не этот сборщик.
 *
 * «Нагрузка» фичи (нет браузерного per-feature CPU) измеряется как
 * execution-time прокси: время в `enable()` (init) + суммарное время её
 * DOM-колбэков (runtime), всё через `performance.now()`.
 */

const API_WINDOW_MS = 60_000;

class PerfCollector {
  /** id фичи → время в её enable(), мс (последнее измерение). */
  private readonly featureInit = new Map<string, number>();
  /** id фичи → накопленное время DOM-колбэков, мс. */
  private readonly featureRuntime = new Map<string, number>();

  /** Накопительный счётчик VK API-вызовов. */
  private apiCalls = 0;
  /** Кольцевой буфер таймстемпов вызовов для расчёта rate за окно. */
  private apiTimestamps: number[] = [];

  recordFeatureInit(id: string, ms: number): void {
    this.featureInit.set(id, ms);
  }

  addFeatureRuntime(id: string, ms: number): void {
    this.featureRuntime.set(id, (this.featureRuntime.get(id) ?? 0) + ms);
  }

  /** Снимает фичу с учёта (при disable) — чтобы список не копил мёртвые id. */
  clearFeature(id: string): void {
    this.featureInit.delete(id);
    this.featureRuntime.delete(id);
  }

  recordApiCall(): void {
    this.apiCalls++;
    const now = Date.now();
    this.apiTimestamps.push(now);
    // Подрезаем окно лениво, на каждой записи — буфер не растёт безгранично.
    const cutoff = now - API_WINDOW_MS;
    if (this.apiTimestamps[0]! < cutoff) {
      this.apiTimestamps = this.apiTimestamps.filter((t) => t >= cutoff);
    }
  }

  getFeatureInit(id: string): number {
    return this.featureInit.get(id) ?? 0;
  }

  getFeatureRuntime(id: string): number {
    return this.featureRuntime.get(id) ?? 0;
  }

  /** Суммарное время инициализации всех фич, мс. */
  getTotalInitMs(): number {
    let total = 0;
    for (const ms of this.featureInit.values()) total += ms;
    return total;
  }

  getApiCalls(): number {
    return this.apiCalls;
  }

  /** Число API-вызовов за последние 60 секунд. */
  apiCallsLastMin(): number {
    const cutoff = Date.now() - API_WINDOW_MS;
    let count = 0;
    for (const t of this.apiTimestamps) if (t >= cutoff) count++;
    return count;
  }
}

/** Singleton: один content-скрипт = один сборщик. */
export const perfCollector = new PerfCollector();
