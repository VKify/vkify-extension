import { domObserver, queryAll, type Unsubscribe } from '@/content/core/dom/index.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { coalesceFrame } from '@/content/utils/raf-coalesce.js';

/**
 * Рефлоу плавающего мини-чата (Floating Chat) при скрытии диалогов.
 *
 * Зачем JS, а не CSS: строки `.FCConvoListItem` позиционированы АБСОЛЮТНО —
 * VK выставляет каждой инлайновый `top` (index * height) внутри скролл-
 * контейнера фиксированной высоты. `display:none` на одной строке прячет её,
 * но НЕ сдвигает соседей — остаётся пустая дыра, а высота контейнера не
 * меняется. CSS не умеет пересчитывать абсолютные `top`, поэтому компактим
 * список вручную.
 *
 * Алгоритм (вычитание смещения — безопасен к скроллу): идём по строкам в
 * порядке их ИСХОДНОГО (VK-шного) `top`; за каждой скрытой строкой копим
 * `hiddenOffset` (её высоту), а видимым выставляем `top = origTop − hiddenOffset`.
 * Высоту контейнера уменьшаем на суммарную высоту скрытых строк. Вычитание
 * (а не нумерация с нуля) сохраняет позицию скролла.
 *
 * Идемпотентность. Мы пишем те же `top`, которые потом читаем, поэтому на
 * каждый элемент храним пару {origTop, writtenTop}: если текущий `top` совпадает
 * с нашим последним `writtenTop` — это НАША запись, берём сохранённый origTop;
 * если отличается — VK перерисовал, текущее значение и есть новый origTop. То же
 * для высоты контейнера. Без этого повторные проходы вычитали бы смещение
 * каскадом. Состояние НЕ сбрасывается между start() — иначе наша же компактная
 * раскладка была бы прочитана как «исходная». Отсоединённые элементы вычищаем
 * по isConnected, на stop() восстанавливаем исходные значения.
 *
 * Два уровня наблюдения:
 *  1. Общий domObserver (единственный childList-observer на body) — ловит
 *     ПОЯВЛЕНИЕ списка мини-чата. Это критично для перезагрузки страницы: окно
 *     мини-чата VK создаёт ПОЗЖЕ инициализации контент-скрипта, контейнера ещё
 *     нет в момент enable() — без этой подписки первый рефлоу был бы no-op, и
 *     после релоада чаты оставались бы на своих местах с дырами.
 *  2. УЗКИЙ собственный MutationObserver на скролл-контейнере (childList +
 *     style) — общий domObserver не следит за атрибутами, а VK переписывает
 *     `top` при скролле / новом сообщении / ре-рендере именно через style.
 *
 * От зацикливания на собственных записях защищаемся схемой
 * disconnect → запись → reconnect.
 */

const DEFAULT_ITEM_HEIGHT = 44;

/** Исходное (VK-шное) значение `orig` и наша последняя запись `written`. */
interface Tracked { orig: number; written: number; }

let hiddenNames = new Set<string>();
let observer: MutationObserver | null = null;
let unsubAppear: Unsubscribe | null = null;
const topState = new Map<HTMLElement, Tracked>();
const heightState = new Map<HTMLElement, Tracked>();

/**
 * Восстанавливает ИСХОДНОЕ значение: если текущее равно нашей последней записи —
 * это наша запись, берём сохранённый `orig`; иначе VK перерисовал и текущее
 * значение и есть новый `orig`.
 */
function recoverOriginal(cur: number, st: Tracked | undefined): number {
  return st && cur === st.written ? st.orig : cur;
}

/** Парсит число пикселей из инлайнового стиля (`top`/`height`); null если нет. */
function readPx(el: HTMLElement, prop: 'top' | 'height'): number | null {
  const raw = el.style.getPropertyValue(prop);
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** Высота строки: из инлайнового стиля, иначе дефолт мини-чата. */
function itemHeight(el: HTMLElement): number {
  return readPx(el, 'height') ?? DEFAULT_ITEM_HEIGHT;
}

/** Исходный (VK-шный) `top` строки. */
function originalTop(el: HTMLElement): number {
  return recoverOriginal(readPx(el, 'top') ?? 0, topState.get(el));
}

/** Идемпотентная запись `top` + фиксация orig/written. */
function writeTop(el: HTMLElement, orig: number, top: number): void {
  if ((readPx(el, 'top') ?? 0) !== top) el.style.top = `${top}px`;
  topState.set(el, { orig, written: top });
}

/** Исходная (VK-шная) высота контейнера; null — если высота не задана инлайном. */
function originalHeight(container: HTMLElement): number | null {
  const cur = readPx(container, 'height');
  return cur === null ? null : recoverOriginal(cur, heightState.get(container));
}

/** Скролл-контейнеры, реально содержащие строки мини-чата. */
function findContainers(): HTMLElement[] {
  return queryAll<HTMLElement>(SELECTORS.floatingChat.scrollContent)
    .filter(c => c.querySelector(SELECTORS.floatingChat.listItem));
}

/** Чистит из state-таблиц элементы, отсоединённые от документа. */
function pruneDetached(): void {
  for (const el of topState.keys()) if (!el.isConnected) topState.delete(el);
  for (const el of heightState.keys()) if (!el.isConnected) heightState.delete(el);
}

/** Один проход компактизации по всем контейнерам мини-чата. */
function reflowOnce(): void {
  pruneDetached();

  for (const container of findContainers()) {
    const items = queryAll<HTMLElement>(SELECTORS.floatingChat.listItem, container)
      .map(el => ({ el, origTop: originalTop(el), height: itemHeight(el) }))
      .sort((a, b) => a.origTop - b.origTop);

    let hiddenOffset = 0;

    for (const item of items) {
      const name = item.el.getAttribute('aria-label') ?? '';
      if (hiddenNames.has(name)) {
        hiddenOffset += item.height;
        continue;
      }
      writeTop(item.el, item.origTop, item.origTop - hiddenOffset);
    }

    // Сжимаем высоту контента на суммарную высоту скрытых строк (hiddenOffset).
    const origHeight = originalHeight(container);
    if (origHeight !== null && hiddenOffset > 0) {
      const target = origHeight - hiddenOffset;
      if ((readPx(container, 'height') ?? 0) !== target) container.style.height = `${target}px`;
      heightState.set(container, { orig: origHeight, written: target });
    }
  }
}

/** Возвращает исходное значение там, где ещё стоит наша запись, и чистит карту. */
function restoreMap(map: Map<HTMLElement, Tracked>, prop: 'top' | 'height'): void {
  for (const [el, st] of map) {
    if (el.isConnected && (readPx(el, prop) ?? 0) === st.written) {
      el.style.setProperty(prop, `${st.orig}px`);
    }
  }
  map.clear();
}

/** Возвращает строкам/контейнерам исходные `top`/`height` и чистит state. */
function restore(): void {
  restoreMap(topState, 'top');
  restoreMap(heightState, 'height');
}

/** Рефлоу под собственным observer'ом: disconnect → запись → reconnect. */
const reflow = coalesceFrame(() => {
  observer?.disconnect();
  try {
    reflowOnce();
  } finally {
    attachObserver();
  }
});

/** (Пере)подключает узкий observer к актуальным контейнерам мини-чата. */
function attachObserver(): void {
  if (!observer) observer = new MutationObserver(() => reflow());
  for (const container of findContainers()) {
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
  }
}

export const fcListReflow = {
  /**
   * Запускает (или перезапускает) рефлоу для заданного набора скрытых имён.
   * Идемпотентно — безопасно дёргать повторно (напр. на reapplyOnNavigate).
   * Состояние трекинга НЕ сбрасывается: оно нужно, чтобы отличить свои записи
   * от VK-шных при повторном проходе.
   */
  start(names: Set<string>): void {
    hiddenNames = names;
    observer?.disconnect();
    if (names.size === 0) {
      reflow.cancel();
      unsubAppear?.(); unsubAppear = null;
      restore();
      observer = null;
      return;
    }
    // Бутстрап: общий domObserver дёргает reflow при появлении строк мини-чата
    // (initial-скан + будущие вставки) — покрывает случай, когда окно мини-чата
    // создаётся уже после enable() (перезагрузка страницы).
    unsubAppear?.();
    unsubAppear = domObserver.observeMatches(SELECTORS.floatingChat.listItem, () => reflow());
    reflowOnce();
    attachObserver();
  },

  /** Останавливает рефлоу, возвращает исходную раскладку и снимает observer. */
  stop(): void {
    hiddenNames = new Set();
    reflow.cancel();
    unsubAppear?.(); unsubAppear = null;
    observer?.disconnect();
    observer = null;
    restore();
  },
};