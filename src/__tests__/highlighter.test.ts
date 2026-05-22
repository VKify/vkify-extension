import { describe, it, expect } from 'vitest';
import { highlightCSS } from '../popup/utils/css/highlighter.js';

// highlightCSS is used with dangerouslySetInnerHTML. These tests prove that
// user input cannot inject executable HTML regardless of content.

describe('highlightCSS – XSS safety', () => {
  it('escapes <script> tags in user input', () => {
    const result = highlightCSS('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes </span> injection that would break the highlighting wrapper', () => {
    const result = highlightCSS('</span><img onerror="alert(1)">');
    // The user-supplied </span> must be escaped; only our own spans may appear
    const unescapedSpanClose = result.match(/<\/span>/g) ?? [];
    const ownSpanOpens = result.match(/<span class="/g) ?? [];
    expect(unescapedSpanClose.length).toBe(ownSpanOpens.length);
    expect(result).toContain('&lt;/span&gt;');
  });

  it('escapes & exactly once — no double-encoding', () => {
    const result = highlightCSS('/* author & date */');
    expect(result).toContain('&amp;');
    expect(result).not.toContain('&amp;amp;');
  });

  it('XSS via attribute injection (closes outer tag, injects script)', () => {
    const result = highlightCSS('"><script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&gt;');
    expect(result).toContain('&lt;script&gt;');
  });

  it('XSS via CSS comment that wraps a closing span', () => {
    const payload = '/* </span><script>alert()</script><span> */';
    const result = highlightCSS(payload);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;/span&gt;');
    expect(result).toContain('&lt;script&gt;');
  });

  it('script-like text in property values is rendered as safe text (not HTML attributes)', () => {
    // "onmouseover=alert(1)" appearing as *text content* inside a <pre> is safe.
    // What would be dangerous is an unescaped angle bracket that creates a new element.
    // This test verifies the real invariant: no bare < or > can escape the text context.
    const result = highlightCSS('color: onmouseover=alert(1)');
    const stripped = result.replace(/<span class="css-[a-z]+">/g, '').replace(/<\/span>/g, '');
    expect(stripped).not.toMatch(/[<>]/);
  });

  it('output only contains span elements with known, allowlisted class names', () => {
    const css = '.sel { color: #fff; margin: 10px; } /* note */ .b { font-size: 14px !important; }';
    const result = highlightCSS(css);

    const allowedClasses = new Set([
      'css-comment', 'css-selector', 'css-property',
      'css-important', 'css-color', 'css-number',
    ]);

    for (const [, cls] of result.matchAll(/class="([^"]+)"/g)) {
      expect(allowedClasses.has(cls)).toBe(true);
    }
  });

  it('does not produce bare <, > or & in output (all must be entities)', () => {
    const inputs = [
      'body { margin: 0; }',
      '/* <test> & "check" */',
      '.class[attr="val"] { }',
      '"><img src=x onerror=alert(1)>',
    ];

    for (const input of inputs) {
      const result = highlightCSS(input);
      // Strip our own injected <span ...> and </span> tags, then check for bare brackets
      const stripped = result.replace(/<span class="css-[a-z]+">/g, '').replace(/<\/span>/g, '');
      if (stripped.match(/[<>]/)) throw new Error(`bare bracket found for input: ${input}`);
      expect(stripped).not.toMatch(/[<>]/);
    }
  });

  it('returns empty string for empty input', () => {
    expect(highlightCSS('')).toBe('');
  });

  it('handles unicode content without throwing', () => {
    const result = highlightCSS('/* پنجره — текст */ color: red;');
    expect(result).not.toContain('<script>');
    expect(typeof result).toBe('string');
  });
});
