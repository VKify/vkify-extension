import { describe, it, expect } from 'vitest';
import { escapeHtml, safeUrl } from '../shared/utils/html.js';

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" onClick='y'>&`)).toBe(
      '&lt;a href=&quot;x&quot; onClick=&#39;y&#39;&gt;&amp;',
    );
  });
});

describe('safeUrl', () => {
  it('passes through ordinary http(s) links unchanged', () => {
    expect(safeUrl('https://vk.com/im')).toBe('https://vk.com/im');
    expect(safeUrl('http://example.org/a?b=1')).toBe('http://example.org/a?b=1');
  });

  it('allows mailto, tel and data:image schemes', () => {
    expect(safeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(safeUrl('tel:+123')).toBe('tel:+123');
    expect(safeUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
  });

  it('blocks data: URLs that are not images', () => {
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(safeUrl('data:application/javascript,alert(1)')).toBe('#');
  });

  it('keeps relative and anchor links', () => {
    expect(safeUrl('/im?sel=1')).toBe('/im?sel=1');
    expect(safeUrl('#section')).toBe('#section');
  });

  it('neutralises javascript: URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBe('#');
  });

  it('neutralises javascript: hidden by whitespace/control chars', () => {
    expect(safeUrl('  javascript:alert(1)')).toBe('#');
    expect(safeUrl('java\tscript:alert(1)')).toBe('#');
    expect(safeUrl('java\nscript:alert(1)')).toBe('#');
  });

  it('neutralises other dangerous schemes', () => {
    expect(safeUrl('vbscript:msgbox(1)')).toBe('#');
    expect(safeUrl('file:///etc/passwd')).toBe('#');
  });

  it('returns # for empty/nullish input', () => {
    expect(safeUrl('')).toBe('#');
    expect(safeUrl(null)).toBe('#');
    expect(safeUrl(undefined)).toBe('#');
  });
});
