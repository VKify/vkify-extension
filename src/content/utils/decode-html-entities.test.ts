// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { decodeHtmlEntities } from './decode-html-entities.js';

it.each([
  ["angel&#39;s tears ", "angel's tears "],
  ['Rock &amp; Roll &quot;Live&quot;', 'Rock & Roll "Live"'],
  ['&#x27; &apos; &#128148; &nbsp;', "' ' 💔 \u00a0"],
  ['Plain <b>title</b> &unknown;', 'Plain <b>title</b> &unknown;'],
  ['&amp;#39;', '&#39;'],
  ['&lt;img src=x onerror=alert(1)&gt;', '<img src=x onerror=alert(1)>'],
])('decodes metadata %s once as plain text', (input, expected) => {
  expect(decodeHtmlEntities(input)).toBe(expected);
});
