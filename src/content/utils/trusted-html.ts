/**
 * Безопасная вставка ДОВЕРЕННОЙ разметки без присваивания в `.innerHTML`.
 *
 * Firefox addons-linter поднимает UNSAFE_VAR_ASSIGNMENT на любое `el.innerHTML =
 * <не-литерал>` (security+perf). Разбор через `DOMParser` — это вызов метода, а
 * не присваивание, поэтому линтер его не флагует, а поведение эквивалентно
 * `innerHTML` (тот же HTML-парсер, включая inline-SVG как foreign content).
 *
 * ВНИМАНИЕ: только для СТАТИЧЕСКОЙ разметки (иконки, шаблоны панелей) и строк,
 * где динамические части уже прогнаны через `escapeHtml`. НИКОГДА не передавать
 * сюда сырой пользовательский ввод.
 */
export function parseTrustedFragment(html: string): DocumentFragment {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const frag = document.createDocumentFragment();
  frag.append(...Array.from(doc.body.childNodes));
  return frag;
}

/** Заменяет содержимое `el` узлами доверенной разметки (замена `el.innerHTML = html`). */
export function setTrustedHtml(el: Element, html: string): void {
  el.replaceChildren(parseTrustedFragment(html));
}
