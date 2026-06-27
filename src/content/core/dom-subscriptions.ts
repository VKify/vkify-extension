/**
 * Реестр DOM-подписок, привязанных к фиче.
 *
 * Единственный владелец per-id teardown'а DOM-подписок: каждая подписка
 * (`observeMatches`/`observeChanges`/`observeResize`) регистрируется под id фичи
 * и снимается целиком в `teardown(id)` — гарантия, что ни один observer не
 * переживёт выключение фичи (страховка от утечек). Вынесен из FeatureManager,
 * чтобы у этой ответственности был явный владелец.
 *
 * Поверх каждого колбэка навешивается perf-тайминг: время DOM-колбэка относится
 * на runtime-бюджет фичи (execution-time прокси «нагрузки» для Performance
 * Dashboard — браузерного per-feature CPU нет).
 *
 * Связь со ScopedFeatureContext: scope-обёртка фичи делегирует свои
 * `registerMutationObserver`/`observeChanges` сюда (через FeatureContext) и
 * получает обратно idempotent-unsubscribe. Scope трекает их ещё и per-apply-cycle
 * (для reapply), но ИТОГОВЫЙ владелец снятия на disable — этот реестр.
 */

import {
  domObserver as defaultObserver,
  type Unsubscribe, type Priority, type ChangeOpt, type ResizeOpt,
} from './dom/index.js';
import { perfCollector as defaultPerf } from './perf/collector.js';
import type { SelectorSpec } from '../selectors/types.js';

type DomObserver = typeof defaultObserver;
type PerfCollector = typeof defaultPerf;

export class DomSubscriptionRegistry {
  private readonly subs = new Map<string, Set<Unsubscribe>>();

  constructor(
    private readonly observer: DomObserver = defaultObserver,
    private readonly perf: PerfCollector = defaultPerf,
  ) {}

  observeMatches(
    id: string, spec: SelectorSpec, onMatch: (el: Element) => void, priority?: Priority,
  ): Unsubscribe {
    const timed = (el: Element) => this.time(id, () => onMatch(el));
    return this.track(id, this.observer.observeMatches(spec, timed, priority));
  }

  observeChanges(id: string, cb: () => void, opt?: ChangeOpt): Unsubscribe {
    const timed = () => this.time(id, cb);
    return this.track(id, this.observer.observeChanges(timed, opt));
  }

  observeResize(id: string, el: Element, cb: () => void, opt?: ResizeOpt): Unsubscribe {
    const timed = () => this.time(id, cb);
    return this.track(id, this.observer.observeResize(el, timed, opt));
  }

  /** Снимает все подписки фичи (вызывается FeatureManager.disable). */
  teardown(id: string): void {
    const set = this.subs.get(id);
    if (!set) return;
    for (const off of set) off();
    this.subs.delete(id);
  }

  /** Замеряет время одного DOM-колбэка и относит его на runtime-бюджет фичи.
   *  Ошибки не глотает — их ловит сам observer (safeCall). */
  private time(id: string, fn: () => void): void {
    const startedAt = performance.now();
    try {
      fn();
    } finally {
      this.perf.addFeatureRuntime(id, performance.now() - startedAt);
    }
  }

  private track(id: string, off: Unsubscribe): Unsubscribe {
    let set = this.subs.get(id);
    if (!set) { set = new Set(); this.subs.set(id, set); }
    const wrapped: Unsubscribe = () => { off(); set!.delete(wrapped); };
    set.add(wrapped);
    return wrapped;
  }
}
