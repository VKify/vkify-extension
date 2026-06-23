import { specCandidates, type SelectorSpec } from '@/content/selectors/types.js';

/**
 * querySelector, который не падает на: невалидном селекторе (старые движки
 * кидают SyntaxError на :has и т.п.), отсутствующем root, или null-узле.
 */
export function safeQuerySelector<T extends Element = Element>(
  spec: SelectorSpec,
  root: ParentNode | null = document,
): T | null {
  if (!root) return null;
  for (const sel of specCandidates(spec)) {
    try {
      const el = root.querySelector<T>(sel);
      if (el) return el;
    } catch { /* невалидный селектор для этого движка — пробуем следующий */ }
  }
  return null;
}

/** Первый кандидат-селектор, давший ≥1 совпадение (как findAudioRows). */
export function queryAll<T extends Element = Element>(
  spec: SelectorSpec,
  root: ParentNode = document,
): T[] {
  for (const sel of specCandidates(spec)) {
    try {
      const list = root.querySelectorAll<T>(sel);
      if (list.length) return Array.from(list);
    } catch { /* skip */ }
  }
  return [];
}

/** Совпадает ли элемент хотя бы с одним кандидатом spec. */
export function matchesSpec(el: Element, spec: SelectorSpec): boolean {
  for (const sel of specCandidates(spec)) {
    try { if (el.matches(sel)) return true; } catch { /* skip */ }
  }
  return false;
}
