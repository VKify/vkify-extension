/**
 * Лёгкий DI-контейнер для общих сервисов content-скрипта.
 *
 * Зачем: вместо того чтобы каждая фича импортировала синглтоны напрямую
 * (`import { domObserver }`, `import { perfCollector }` …), сервисы регистрируются
 * в одном месте и берутся по строковому id. Это даёт единую точку жизненного
 * цикла, ленивую инициализацию и возможность подменять реализацию в тестах.
 *
 * Контейнер намеренно «глупый»: знает только id → значение/фабрика. Типизация
 * известных сервисов живёт в `services/index.ts` (SERVICES + ServiceTypeMap +
 * getService), чтобы сам контейнер оставался переиспользуемым и без зависимостей
 * на конкретные сервисы.
 */

export type ServiceFactory<T> = (container: ServiceContainer) => T;

export class ServiceContainer {
  /** Уже инстанцированные сервисы (или зарегистрированные значением). */
  private readonly values = new Map<string, unknown>();
  /** Ленивые фабрики — вызываются один раз при первом get(id). */
  private readonly factories = new Map<string, ServiceFactory<unknown>>();
  /** Защита от циклов при ленивом разрешении. */
  private readonly resolving = new Set<string>();

  /** Регистрирует готовый экземпляр. Перетирает прежнюю регистрацию (идемпотентно). */
  registerValue<T>(id: string, value: T): this {
    this.values.set(id, value);
    this.factories.delete(id);
    return this;
  }

  /**
   * Регистрирует ленивую фабрику: экземпляр создаётся при первом get(id) и
   * кэшируется (де-факто синглтон). Перерегистрация сбрасывает кэш.
   */
  registerFactory<T>(id: string, factory: ServiceFactory<T>): this {
    this.factories.set(id, factory as ServiceFactory<unknown>);
    this.values.delete(id);
    return this;
  }

  has(id: string): boolean {
    return this.values.has(id) || this.factories.has(id);
  }

  /**
   * Возвращает сервис по id. Для ленивых — инстанцирует фабрику при первом
   * обращении и кэширует результат. Бросает, если сервис не зарегистрирован.
   */
  get<T>(id: string): T {
    if (this.values.has(id)) return this.values.get(id) as T;

    const factory = this.factories.get(id);
    if (!factory) throw new Error(`[VKify] Service not registered: "${id}"`);

    if (this.resolving.has(id)) {
      throw new Error(`[VKify] Circular service dependency while resolving "${id}"`);
    }
    this.resolving.add(id);
    try {
      const value = factory(this);
      this.values.set(id, value); // кэшируем — singleton
      return value as T;
    } finally {
      this.resolving.delete(id);
    }
  }

  /** Как get(), но возвращает undefined вместо исключения для незарегистрированных. */
  tryGet<T>(id: string): T | undefined {
    return this.has(id) ? this.get<T>(id) : undefined;
  }

  /** Сбрасывает один сервис или весь контейнер — нужно главным образом в тестах. */
  reset(id?: string): void {
    if (id) {
      this.values.delete(id);
      this.factories.delete(id);
    } else {
      this.values.clear();
      this.factories.clear();
    }
  }
}
