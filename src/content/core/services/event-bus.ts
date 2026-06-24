/**
 * Минималистичная типобезопасная шина событий для content-скрипта.
 *
 * Канал расцепления между подсистемами: FeatureManager публикует жизненный цикл
 * фич (`feature:enabled` / `feature:disabled`), а любые будущие подписчики могут
 * на это реагировать, не завязываясь на сам менеджер. Без слушателей emit()
 * стоит один lookup в Map — overhead близок к нулю.
 *
 * Внутри-контентная (не путать с `dispatchPageEvent`, который шлёт CustomEvent в
 * page-world к инжектированным скриптам). Эта шина — чисто внутри content-realm.
 */

export type EventListener<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<EventListener<unknown>>>();

  /** Подписка. Возвращает функцию отписки. */
  on<K extends keyof Events>(event: K, fn: EventListener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as EventListener<unknown>);
    return () => { set!.delete(fn as EventListener<unknown>); };
  }

  /** Одноразовая подписка: снимается сразу после первого срабатывания. */
  once<K extends keyof Events>(event: K, fn: EventListener<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off<K extends keyof Events>(event: K, fn: EventListener<Events[K]>): void {
    this.listeners.get(event)?.delete(fn as EventListener<unknown>);
  }

  /** Публикует событие. Ошибка в одном слушателе не роняет остальных. */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    // Копия — слушатель может отписаться/подписаться во время доставки.
    for (const fn of [...set]) {
      try {
        (fn as EventListener<Events[K]>)(payload);
      } catch (e) {
        console.error(`[VKify] EventBus listener error for "${String(event)}":`, e);
      }
    }
  }

  /** Снимает слушателей одного события или всех сразу. */
  clear<K extends keyof Events>(event?: K): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

/**
 * События внутренней шины content-скрипта.
 *
 * Объявлено через `type`, а не `interface`: только псевдоним удовлетворяет
 * ограничению `Record<string, unknown>` у EventBus (интерфейс не получает
 * неявную индексную сигнатуру, т.к. допускает аугментацию).
 */
export type ContentBusEvents = {
  /** Фича успешно активирована FeatureManager'ом. */
  'feature:enabled': { id: string; value: unknown };
  /** Фича деактивирована FeatureManager'ом. */
  'feature:disabled': { id: string };
};
