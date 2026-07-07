/**
 * Токенизатор CSS для подсветки в редакторе. Возвращает ПЛОСКИЙ список токенов
 * `{ cls, text }`, а не HTML-строку — рендер делает React (`<span>`/текст), сам
 * экранируя содержимое. Так пользовательский CSS структурно не может внедрить
 * разметку: мы нигде не собираем HTML и не трогаем innerHTML (раньше здесь была
 * HTML-строка под `dangerouslySetInnerHTML`).
 */

/** Классы токенов = имена CSS-классов подсветки (styles в CSSEditorTab). */
export type CssTokenClass =
  | 'css-comment'
  | 'css-selector'
  | 'css-property'
  | 'css-important'
  | 'css-color'
  | 'css-number';

export interface CssToken {
  /** null — обычный текст (без подсветки). */
  cls: CssTokenClass | null;
  text: string;
}

const IMPORTANT_RE = /^!important/i;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}/;
const NUMBER_RE = /^\d+\.?\d*(?:px|em|rem|%|vh|vw|deg|s|ms)/i;
const PROPERTY_RE = /^[A-Za-z_-][\w-]*(?=\s*:)/; // идентификатор перед ':'
const SELECTOR_RE = /^[^{}]+?(?=\{)/;             // всё до '{' вне блока

/**
 * Токенизирует CSS одним проходом с учётом контекста фигурных скобок:
 * вне `{}` — селекторы, внутри — свойства/значения. Комментарии атомарны.
 * Токены не пересекаются, а конкатенация их `text` в точности равна входу
 * (лосслесс) — гарантия, что подсветка ничего не теряет и не добавляет.
 */
export function tokenizeCSS(code: string): CssToken[] {
  const out: CssToken[] = [];
  if (!code) return out;

  let plain = '';
  const flushPlain = (): void => {
    if (plain) { out.push({ cls: null, text: plain }); plain = ''; }
  };
  const push = (cls: CssTokenClass, text: string): void => {
    flushPlain();
    out.push({ cls, text });
  };

  let depth = 0; // 0 — контекст селектора, >0 — внутри блока объявлений
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    const ch = code[i];

    // Комментарий — атомарный токен (может быть многострочным).
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end === -1 ? code.length : end + 2;
      push('css-comment', code.slice(i, stop));
      i = stop;
      continue;
    }

    if (ch === '{') { plain += ch; flushPlain(); depth++; i++; continue; }
    if (ch === '}') { plain += ch; flushPlain(); depth = Math.max(0, depth - 1); i++; continue; }

    let m = IMPORTANT_RE.exec(rest);
    if (m) { push('css-important', m[0]); i += m[0].length; continue; }
    m = COLOR_RE.exec(rest);
    if (m) { push('css-color', m[0]); i += m[0].length; continue; }
    m = NUMBER_RE.exec(rest);
    if (m) { push('css-number', m[0]); i += m[0].length; continue; }

    if (depth === 0) {
      m = SELECTOR_RE.exec(rest);
      if (m && m[0].length > 0) { push('css-selector', m[0]); i += m[0].length; continue; }
    } else {
      m = PROPERTY_RE.exec(rest);
      if (m) { push('css-property', m[0]); i += m[0].length; continue; }
    }

    plain += ch;
    i++;
  }
  flushPlain();
  return out;
}
