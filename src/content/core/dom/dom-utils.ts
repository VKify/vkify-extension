/**
 * Чистые DOM-утилиты поверх слоя селекторов. Без состояния и без подписок —
 * это надстройка над query.ts для разовых выборок. Всё, что требует слежения за
 * DOM во времени, живёт в dom-observer.ts (observeMatches / waitForElement).
 */

import type { SelectorSpec } from '@/content/selectors/types.js';
import { matchesSpec, safeQuerySelector } from './query.js';

// specUnion («совпасть с любым кандидатом», для делегирования событий) уже
// живёт в слое селекторов — реэкспортируем, чтобы фичам хватало одного импорта
// из core/dom вместо двух.
export { specUnion } from '@/content/selectors/types.js';

/**
 * Ближайший предок (включая сам узел), совпавший с любым кандидатом spec —
 * spec-aware аналог Element.closest, переживающий невалидные селекторы и
 * перебирающий fallback-кандидаты. Возвращает null, если совпадения нет.
 *
 * Зачем вместо el.closest(specUnion(spec)): closest по union-строке упадёт
 * целиком, если ЛЮБОЙ кандидат невалиден для движка (старый Edge на :has);
 * здесь каждый кандидат проверяется изолированно.
 */
export function findClosestVkElement<T extends Element = Element>(
  start: Element | null,
  spec: SelectorSpec,
): T | null {
  for (let el: Element | null = start; el; el = el.parentElement) {
    if (matchesSpec(el, spec)) return el as T;
  }
  return null;
}

/** Есть ли в root хотя бы один элемент, совпавший со spec. */
export function exists(spec: SelectorSpec, root: ParentNode | null = document): boolean {
  return safeQuerySelector(spec, root) !== null;
}

/** trimmed-текст первого совпавшего элемента ('' если не найден). */
export function getText(spec: SelectorSpec, root: ParentNode | null = document): string {
  return safeQuerySelector<HTMLElement>(spec, root)?.textContent?.trim() ?? '';
}

/** Значение атрибута первого совпавшего элемента (null если нет элемента/атрибута). */
export function getAttr(
  spec: SelectorSpec, attr: string, root: ParentNode | null = document,
): string | null {
  return safeQuerySelector(spec, root)?.getAttribute(attr) ?? null;
}

/** Прикреплён ли узел к живому документу (дешёвый guard перед работой с ним). */
export function isAttached(el: Element | null): el is Element {
  return !!el && el.isConnected;
}
