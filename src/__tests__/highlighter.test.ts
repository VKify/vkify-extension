import { describe, it, expect } from 'vitest';
import { tokenizeCSS, type CssTokenClass } from '../popup/utils/css/highlighter.js';

// tokenizeCSS returns a flat list of {cls, text} tokens rendered by React as
// <span>/text. React escapes text on render, so user CSS structurally cannot
// inject markup — we never build an HTML string (no dangerouslySetInnerHTML).
// These tests lock the two invariants that guarantee that: token text is the
// RAW input (lossless, no HTML added by us) and classes are allowlisted.

const ALLOWED: ReadonlySet<CssTokenClass> = new Set<CssTokenClass>([
  'css-comment', 'css-selector', 'css-property',
  'css-important', 'css-color', 'css-number',
]);

const joined = (css: string): string => tokenizeCSS(css).map(t => t.text).join('');

describe('tokenizeCSS – safety by construction', () => {
  it('is lossless: concatenated token text equals the input', () => {
    const inputs = [
      '.sel { color: #fff; margin: 10px; } /* note */ .b { font-size: 14px !important; }',
      'body { margin: 0; }',
      '/* <test> & "check" */',
      '.class[attr="val"] { }',
      'color: red; /* trailing',            // незакрытый комментарий
      '/* پنجره — текст */ color: red;',     // юникод
    ];
    for (const input of inputs) expect(joined(input)).toBe(input);
  });

  it('never emits HTML control characters of its own (they stay as plain text)', () => {
    // Раньше подсветка строила HTML-строку; теперь текст токенов — сырой ввод,
    // а экранирование делает React. Токенайзер не должен добавлять < > & сам.
    const payloads = [
      '<script>alert(1)</script>',
      '</span><img onerror="alert(1)">',
      '"><script>alert(1)</script>',
      '/* </span><script>alert()</script><span> */',
    ];
    for (const p of payloads) {
      // Ни один токен не «изобретает» разметку — весь ввод сохранён дословно.
      expect(joined(p)).toBe(p);
      // И ничего не экранировано на этом уровне (это работа React при рендере).
      expect(joined(p)).not.toContain('&lt;');
    }
  });

  it('only uses allowlisted class names (or null)', () => {
    const css = '.sel { color: #fff; margin: 10px; } /* note */ .b { font-size: 14px !important; }';
    for (const tok of tokenizeCSS(css)) {
      if (tok.cls !== null) expect(ALLOWED.has(tok.cls)).toBe(true);
    }
  });

  it('classifies the common token kinds', () => {
    const toks = tokenizeCSS('.a { color: #abc; width: 10px !important; } /* c */');
    const has = (cls: CssTokenClass): boolean => toks.some(t => t.cls === cls);
    expect(has('css-selector')).toBe(true);
    expect(has('css-property')).toBe(true);
    expect(has('css-color')).toBe(true);
    expect(has('css-number')).toBe(true);
    expect(has('css-important')).toBe(true);
    expect(has('css-comment')).toBe(true);
  });

  it('keeps a comment as a single atomic token', () => {
    const toks = tokenizeCSS('/* a #fff 10px !important */');
    expect(toks).toHaveLength(1);
    expect(toks[0]).toEqual({ cls: 'css-comment', text: '/* a #fff 10px !important */' });
  });

  it('returns an empty list for empty input', () => {
    expect(tokenizeCSS('')).toEqual([]);
  });
});
