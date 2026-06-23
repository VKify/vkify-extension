/**
 * Селектор — либо одна строка, либо упорядоченный список кандидатов
 * (от точного к более общему), как уже принято в features/.../message-dom.ts.
 * Несколько кандидатов нужны, потому что разметка VK варьируется по версиям
 * движка (bubble / no-bubble, AudioRow_root vs AudioRow__root и т.п.).
 */
export type SelectorSpec = string | readonly string[];

/**
 * Динамический селектор — фабрика, которая строит SelectorSpec из параметров
 * рантайма (peer_id, owner_id, индекс и т.п.). Нужна для случаев, где селектор
 * нельзя зафиксировать статически (напр. `.dialog[data-peer-id="<id>"]`).
 *
 * Возвращает обычный SelectorSpec, поэтому результат напрямую скармливается
 * safeQuerySelector / queryAll / observeMatches — слой запросов про динамику не
 * знает, разрешает её вызывающая фича:
 *
 *   const spec = SELECTORS.messages.dialogByPeer('2000000123');
 *   const el = safeQuerySelector(spec);
 *
 * ВАЖНО: динамические селекторы НЕ годятся для observeMatches со «следящей»
 * семантикой, если параметр меняется на лету — подписку нужно пересоздавать.
 */
export type DynamicSelector = (...args: string[]) => SelectorSpec;

/** Запись в группе: статический спек или его динамическая фабрика. */
export type SelectorEntry = SelectorSpec | DynamicSelector;

/** Группа селекторов одного раздела VK. */
export type SelectorGroup = Record<string, SelectorEntry>;

/** Тип-гард: запись — динамическая фабрика, а не статический спек. */
export function isDynamicSelector(entry: SelectorEntry): entry is DynamicSelector {
  return typeof entry === 'function';
}

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
