// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { extractCmid, extractMessageText } from './message-dom.js';

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

describe('extractMessageText', () => {
  it('copies VK emoji replacements as their full Unicode sequences', () => {
    document.body.innerHTML = `
      <div class="ConvoHistory__messageBlock">
        <div class="ConvoMessageBubble__text">Привет <img class="Emoji" alt="😂"> <img class="Emoji" alt="❤️"> <img class="Emoji" alt="👍🏻"> <img class="Emoji" alt="👨‍💻"></div>
      </div>`;
    const block = document.querySelector('.ConvoHistory__messageBlock')!;
    expect(extractMessageText(block)).toBe('Привет 😂 ❤️ 👍🏻 👨‍💻');
  });

  it('keeps ordinary message text unchanged', () => {
    document.body.innerHTML = '<div class="ConvoHistory__messageBlock"><div class="ConvoMessageBubble__text">Обычный текст</div></div>';
    expect(extractMessageText(document.querySelector('.ConvoHistory__messageBlock')!)).toBe('Обычный текст');
  });
});
