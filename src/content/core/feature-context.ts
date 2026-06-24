import type { SelectorSpec } from '@/content/selectors/types.js';
import type { SELECTORS } from '@/content/selectors/index.js';
import type { Priority, ChangeOpt, ResizeOpt, Unsubscribe } from './dom/index.js';
import type { ServiceContainer } from './services/index.js';

/**
 * Узкий DOM-контракт, который фича получает от FeatureManager. Даёт доступ к
 * централизованному реестру селекторов и к привязанным-к-фиче подпискам:
 * любой observer, заведённый через контекст, снимается автоматически при
 * disable() фичи — фиче не нужно держать собственный MutationObserver/teardown.
 *
 * FeatureManager реализует этот интерфейс (`implements FeatureContext`), поэтому
 * фичи, уже получающие manager, типобезопасно видят минимально нужный срез, а
 * новые могут принимать просто FeatureContext вместо всего менеджера.
 */
export interface FeatureContext {
  /** Централизованный реестр селекторов VK (см. selectors/index.ts). */
  readonly selectors: typeof SELECTORS;

  /**
   * DI-контейнер общих сервисов (domObserver, perfCollector, cssManager,
   * scriptInjector, storage, featureRegistry, eventBus). Доступ по строковому id;
   * для типобезопасного варианта см. getService(SERVICES.*) из core/services.
   */
  readonly services: ServiceContainer;

  /**
   * Подписка на появление элементов по spec (initial-скан + будущие вставки),
   * привязанная к фиче id. Снимается на disable(id).
   */
  observeMatches(
    id: string,
    spec: SelectorSpec,
    onMatch: (el: Element) => void,
    priority?: Priority,
  ): Unsubscribe;

  /** Подписка на изменения DOM/контейнера с debounce/throttle, привязанная к id. */
  observeChanges(id: string, cb: () => void, opt?: ChangeOpt): Unsubscribe;

  /** Подписка на ресайз узла через общий ResizeObserver, привязанная к id. */
  observeResize(id: string, el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe;

  /** Промис появления элемента по spec (или reject по timeout). */
  waitForElement<T extends Element = Element>(
    spec: SelectorSpec, opts?: { timeoutMs?: number },
  ): Promise<T>;
}
