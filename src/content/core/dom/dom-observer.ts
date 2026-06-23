import type { SelectorSpec } from '@/content/selectors/types.js';
import { coalesceFrame } from '@/content/utils/raf-coalesce.js';
import { schedule, type Scheduled, type ScheduleOpt } from './schedule.js';
import { matchesSpec, queryAll, safeQuerySelector } from './query.js';

export type Unsubscribe = () => void;

/**
 * Приоритет подписки. `important` обрабатывается раньше `normal` в одном флаше —
 * для фич, которые должны успеть до того, как VK (или другая фича) перерисует
 * узел (напр. скрытие рекламы должно опередить навешивание кнопок).
 */
export type Priority = 'important' | 'normal';

/** Опции наблюдения за изменениями контейнера. */
export interface ChangeOpt {
  /** Стратегия запуска колбэка (frame / debounce / throttle). По умолчанию 'frame'. */
  schedule?: ScheduleOpt;
  /** Если задан — колбэк дёргается только при мутациях ВНУТРИ этого узла. */
  container?: Element;
  /** Порядок относительно других change-подписок в одном тике. */
  priority?: Priority;
}

/** Опции наблюдения за размером элемента. */
export interface ResizeOpt {
  /** Стратегия запуска колбэка. ResizeObserver уже коалесцирует, но debounce
   *  полезен для дорогих пересчётов раскладки. По умолчанию 'frame'. */
  schedule?: ScheduleOpt;
}

interface MatchSub {
  spec: SelectorSpec;
  onMatch: (el: Element) => void;
  priority: Priority;
  seen: WeakSet<Element>;   // идемпотентность: каждый элемент обрабатываем 1 раз
}
interface ChangeSub {
  notify: Scheduled;
  container: Element | null;
  priority: Priority;
}
interface ResizeSub { notify: Scheduled; }

function safeCall(fn: () => void): void {
  try { fn(); } catch (e) { console.warn('[VKify] DOM subscriber error:', e); }
}

interface NormChangeOpt { schedule: ScheduleOpt; container: Element | null; priority: Priority; }

/** Нормализует разнородный opt observeChanges к внутреннему виду. */
function normalizeChangeOpt(opt?: ScheduleOpt | ChangeOpt): NormChangeOpt {
  // Голый ScheduleOpt ('frame' | {debounceMs} | {throttleMs}) — обратная
  // совместимость с прежней сигнатурой observeChanges(cb, opt).
  if (!opt || opt === 'frame' || 'debounceMs' in opt || 'throttleMs' in opt) {
    return { schedule: (opt as ScheduleOpt) ?? 'frame', container: null, priority: 'normal' };
  }
  return {
    schedule: opt.schedule ?? 'frame',
    container: opt.container ?? null,
    priority: opt.priority ?? 'normal',
  };
}

/**
 * ОДИН MutationObserver + ОДИН ResizeObserver на весь контент-скрипт. Фичи
 * подписываются на появление элементов по селектору, на изменения контейнера
 * и на ресайз узла; observer'ы стартуют при первой подписке и останавливаются,
 * когда подписок не осталось (нулевая стоимость в простое).
 *
 * Почему один общий MutationObserver, а не по observer'у на фичу: VK дёргает
 * body+subtree десятки раз/сек; N независимых observer'ов = N проходов по одним
 * и тем же мутациям. Здесь добавленные узлы собираются один раз за кадр и
 * разводятся по подписчикам в порядке приоритета.
 */
class DomObserver {
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private readonly matchSubs = new Set<MatchSub>();
  private readonly changeSubs = new Set<ChangeSub>();
  private readonly resizeSubs = new Map<Element, Set<ResizeSub>>();
  private pending: Element[] = [];

  // Накопительный счётчик флашей — прокси «частоты мутаций DOM» для телеметрии
  // производительности (Performance Dashboard). Инкремент дешёвый, в простое
  // флашей нет (observer останавливается без подписок).
  private flushCount = 0;

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
      // (frame/debounce/throttle), независимо от match-флаша. important — раньше.
      if (this.changeSubs.size) this.notifyChangeSubs(muts);
    });
    this.observer.observe(document.body ?? document.documentElement, {
      childList: true, subtree: true,
    });
  }

  /** Уведомляет change-подписки в порядке приоритета, с фильтром по контейнеру. */
  private notifyChangeSubs(muts: MutationRecord[]): void {
    for (const prio of ['important', 'normal'] as const) {
      for (const sub of this.changeSubs) {
        if (sub.priority !== prio) continue;
        if (sub.container && !this.mutsTouch(muts, sub.container)) continue;
        sub.notify();
      }
    }
  }

  /** Затронула ли хоть одна мутация поддерево container'а. */
  private mutsTouch(muts: MutationRecord[], container: Element): boolean {
    for (const m of muts) {
      if (m.target instanceof Node && container.contains(m.target)) return true;
    }
    return false;
  }

  private runFlush(): void {
    this.flushCount++;
    const roots = this.pending;
    this.pending = [];
    // important match-подписки получают новые узлы первыми.
    for (const prio of ['important', 'normal'] as const) {
      for (const sub of this.matchSubs) {
        if (sub.priority !== prio) continue;
        for (const root of roots) {
          if (matchesSpec(root, sub.spec)) this.dispatch(sub, root);
          for (const el of queryAll(sub.spec, root)) this.dispatch(sub, el);
        }
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
    if (this.observer) { this.observer.disconnect(); this.observer = null; }
    this.flush.cancel();
    this.pending = [];
  }

  private teardown(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.flush.cancel();
    this.pending = [];
    for (const subs of this.resizeSubs.values())
      for (const s of subs) s.notify.cancel();
    this.resizeSubs.clear();
  }

  private isContextValid(): boolean {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  /**
   * Вызывает onMatch для каждого НОВОГО элемента, совпавшего со spec —
   * сейчас в DOM (initial-скан) и при будущих вставках. Идемпотентно.
   *
   * @param priority `important` — опередить `normal`-подписки в одном флаше.
   */
  observeMatches(
    spec: SelectorSpec,
    onMatch: (el: Element) => void,
    priority: Priority = 'normal',
  ): Unsubscribe {
    const sub: MatchSub = { spec, onMatch, priority, seen: new WeakSet() };
    this.matchSubs.add(sub);
    this.start();
    for (const el of queryAll(spec)) this.dispatch(sub, el); // уже на странице
    return () => { this.matchSubs.delete(sub); this.stopIfIdle(); };
  }

  /**
   * Грубое «что-то изменилось в DOM» с настраиваемым debounce/throttle. Принимает
   * либо голый ScheduleOpt (как раньше), либо объект ChangeOpt с фильтром по
   * контейнеру и приоритетом.
   */
  observeChanges(cb: () => void, opt?: ScheduleOpt | ChangeOpt): Unsubscribe {
    const { schedule: sched, container, priority } = normalizeChangeOpt(opt);
    const sub: ChangeSub = { notify: schedule(cb, sched), container, priority };
    this.changeSubs.add(sub);
    this.start();
    return () => { sub.notify.cancel(); this.changeSubs.delete(sub); this.stopIfIdle(); };
  }

  /**
   * Подписка на изменение размера элемента через общий ResizeObserver. Колбэк
   * проходит через планировщик (по умолчанию frame), чтобы серии resize-событий
   * не перегружали дорогие пересчёты раскладки.
   */
  observeResize(el: Element, cb: () => void, opt: ResizeOpt = {}): Unsubscribe {
    if (typeof ResizeObserver === 'undefined') return () => {};
    this.startResize();

    const sub: ResizeSub = { notify: schedule(cb, opt.schedule ?? 'frame') };
    let subs = this.resizeSubs.get(el);
    if (!subs) { subs = new Set(); this.resizeSubs.set(el, subs); this.resizeObserver!.observe(el); }
    subs.add(sub);

    return () => {
      sub.notify.cancel();
      const set = this.resizeSubs.get(el);
      if (!set) return;
      set.delete(sub);
      if (!set.size) {
        this.resizeSubs.delete(el);
        this.resizeObserver?.unobserve(el);
      }
      this.stopResizeIfIdle();
    };
  }

  private startResize(): void {
    if (this.resizeObserver) return;
    this.resizeObserver = new ResizeObserver((entries) => {
      if (!this.isContextValid()) { this.teardown(); return; }
      for (const entry of entries) {
        const subs = this.resizeSubs.get(entry.target);
        if (subs) for (const s of subs) s.notify();
      }
    });
  }

  private stopResizeIfIdle(): void {
    if (this.resizeSubs.size) return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /** Число активных подписок (match + change + resize) — для телеметрии. */
  subCount(): number {
    let resize = 0;
    for (const set of this.resizeSubs.values()) resize += set.size;
    return this.matchSubs.size + this.changeSubs.size + resize;
  }

  /** Накопленное число флашей observer'а — прокси частоты мутаций. */
  getFlushCount(): number {
    return this.flushCount;
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
