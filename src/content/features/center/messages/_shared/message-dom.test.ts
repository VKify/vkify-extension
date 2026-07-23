// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractCmid } from './message-dom.js';

describe('extractCmid', () => {
  it('reads conversation_message_id from a virtual-scroll parent', () => {
    document.body.innerHTML = '<div data-itemkey="731"><div class="ConvoHistory__messageBlock"></div></div>';
    expect(extractCmid(document.querySelector('.ConvoHistory__messageBlock')!)).toBe(731);
  });

  it('supports data attributes used by alternate /gim markup', () => {
    document.body.innerHTML = '<div class="ConvoHistory__messageBlock"><span data-cmid="812"></span></div>';
    expect(extractCmid(document.querySelector('.ConvoHistory__messageBlock')!)).toBe(812);
  });
});
