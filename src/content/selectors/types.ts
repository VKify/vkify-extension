/**
 * Селектор — либо одна строка, либо упорядоченный список кандидатов
 * (от точного к более общему), как уже принято в features/.../message-dom.ts.
 * Несколько кандидатов нужны, потому что разметка VK варьируется по версиям
 * движка (bubble / no-bubble, AudioRow_root vs AudioRow__root и т.п.).
 */
export type SelectorSpec = string | readonly string[];

/** Группа селекторов одного раздела VK. */
export type SelectorGroup = Record<string, SelectorSpec>;

/** Приводит spec к массиву кандидатов (для единообразного перебора). */
export function specCandidates(spec: SelectorSpec): readonly string[] {
  return typeof spec === 'string' ? [spec] : spec;
}

/**
 * Схлопывает spec в один comma-селектор с UNION-семантикой («совпасть с любым»).
 *
 * Нужно там, где требуется найти ВСЕ элементы, подходящие под любой кандидат
 * (напр. авторасшифровка сообщений во всех версиях UI), а не «первую непустую
 * группу», как в queryAll. CSS-запятая — это и есть нативный OR.
 */
export function specUnion(spec: SelectorSpec): string {
  return specCandidates(spec).join(', ');
}
