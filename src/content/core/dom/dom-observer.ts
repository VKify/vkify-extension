import type { SelectorSpec } from '@/content/selectors/types.js';
import { coalesceFrame } from '@/content/utils/raf-coalesce.js';
import { schedule, type ScheduleOpt } from './schedule.js';
import { matchesSpec, queryAll, safeQuerySelector } from './query.js';

export type Unsubscribe = () => void;

interface MatchSub {
  spec: SelectorSpec;
  onMatch: (el: Element) => void;
  seen: WeakSet<Element>;   // идемпотентность: каждый элемент обрабатываем 1 раз
}
interface ChangeSub { notify: { (): void; cancel: () => void }; }

function safeCall(fn: () => void): void {
  try { fn(); } catch (e) { console.warn('[VKify] DOM subscriber error:', e); }
}

/**
 * ОДИН MutationObserver на весь контент-скрипт. Фичи подписываются на появление
 * элементов по селектору; observer стартует при первой подписке и
 * останавливается, когда подписок не осталось (нулевая стоимость в простое).
 *
 * Почему один общий, а не по observer'у на фичу: VK дёргает body+subtree
 * десятки раз/сек; N независимых observer'ов = N проходов по одним и тем же
 * мутациям. Здесь добавленные узлы собираются один раз за кадр и разводятся
 * по подписчикам.
 */
class DomObserver {
  private observer: MutationObserver | null = null;
  private readonly matchSubs = new Set<MatchSub>();
  private readonly changeSubs = new Set<ChangeSub>();
  private pending: Element[] = [];

  private readonly flush = coalesceFrame(() => this.runFlush());

  private start(): void {
    if (this.observer) return;
    this.observer = new MutationObserver((muts) => {
      // Контекст расширения умер (reload/update) — сворачиваемся целиком,
      // иначе колбэки будут падать на chrome.* и засорять консоль.
      if (!this.isContextValid()) { this.teardown(); return; }

      if (this.matchSubs.size) {
        for (const m of muts)
          for (const n of m.addedNodes)
            if (n instanceof Element) this.pending.push(n);
        if (this.pending.length) this.flush();
      }
      // change-подписки уведомляются через собственный планировщик
      // (frame/debounce/throttle), независимо от match-флаша.
      for (const sub of this.changeSubs) sub.notify();
    });
    this.observer.observe(document.body ?? document.documentElement, {
      childList: true, subtree: true,
    });
  }

  private runFlush(): void {
    const roots = this.pending;
    this.pending = [];
    for (const sub of this.matchSubs) {
      for (const root of roots) {
        if (matchesSpec(root, sub.spec)) this.dispatch(sub, root);
        for (const el of queryAll(sub.spec, root)) this.dispatch(sub, el);
      }
    }
  }

  private dispatch(sub: MatchSub, el: Element): void {
    if (sub.seen.has(el)) return;
    sub.seen.add(el);
    safeCall(() => sub.onMatch(el));
  }

  private stopIfIdle(): void {
    if (this.matchSubs.size || this.changeSubs.size) return;
    this.teardown();
  }

  private teardown(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.flush.cancel();
    this.pending = [];
  }

  private isContextValid(): boolean {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  /**
   * Вызывает onMatch для каждого НОВОГО элемента, совпавшего со spec —
   * сейчас в DOM (initial-скан) и при будущих вставках. Идемпотентно.
   */
  observeMatches(spec: SelectorSpec, onMatch: (el: Element) => void): Unsubscribe {
    const sub: MatchSub = { spec, onMatch, seen: new WeakSet() };
    this.matchSubs.add(sub);
    this.start();
    for (const el of queryAll(spec)) this.dispatch(sub, el); // уже на странице
    return () => { this.matchSubs.delete(sub); this.stopIfIdle(); };
  }

  /** Грубое «что-то изменилось в DOM» с настраиваемым debounce/throttle. */
  observeChanges(cb: () => void, opt: ScheduleOpt = 'frame'): Unsubscribe {
    const sub: ChangeSub = { notify: schedule(cb, opt) };
    this.changeSubs.add(sub);
    this.start();
    return () => { sub.notify.cancel(); this.changeSubs.delete(sub); this.stopIfIdle(); };
  }

  /** Промис, резолвящийся, когда элемент появится (или timeout). */
  waitForElement<T extends Element = Element>(
    spec: SelectorSpec, opts: { timeoutMs?: number } = {},
  ): Promise<T> {
    const existing = safeQuerySelector<T>(spec);
    if (existing) return Promise.resolve(existing);

    return new Promise<T>((resolve, reject) => {
      let off: Unsubscribe = () => {};
      const timer = opts.timeoutMs
        ? window.setTimeout(() => { off(); reject(new Error(`waitForElement timeout: ${spec}`)); }, opts.timeoutMs)
        : 0;
      off = this.observeMatches(spec, (el) => {
        clearTimeout(timer);
        off();
        resolve(el as T);
      });
    });
  }

  /** Срабатывает один раз, когда узел удалён из документа (cleanup-хелпер). */
  whenRemoved(el: Element, cb: () => void): Unsubscribe {
    const off = this.observeChanges(() => {
      if (!document.contains(el)) { off(); cb(); }
    });
    return off;
  }
}

/** Singleton: один контент-скрипт = один observer. */
export const domObserver = new DomObserver();
