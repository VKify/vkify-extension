/** Кнопка «прикрепить как заметку»: по клику сохраняет сообщение в архив. */

import type { PinnedNote } from '../../../../../types/index.js';
import { extractMessageText, extractAuthor, extractTime } from '../_shared/message-dom.js';
import { detectPeerId, detectPeerTitle, extractCmid } from './peer.js';
import { appendNote, makeId } from './notes.js';
import { ICON_PIN, ICON_DONE } from './icons.js';
import { BTN_CLASS } from './constants.js';

export function makeButton(messageBlock: Element): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BTN_CLASS;
  btn.title = 'Сохранить в заметки';
  btn.setAttribute('aria-label', 'Сохранить сообщение в заметки');
  btn.innerHTML = ICON_PIN;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const text = extractMessageText(messageBlock);
    if (!text) return;

    const note: PinnedNote = {
      id: makeId(),
      text,
      author: extractAuthor(messageBlock) || undefined,
      origTime: extractTime(messageBlock) || undefined,
      peerId: detectPeerId() ?? undefined,
      peerTitle: detectPeerTitle() || undefined,
      cmid: extractCmid(messageBlock) ?? undefined,
      addedAt: Date.now(),
    };

    try {
      await appendNote(note);
      btn.classList.add(`${BTN_CLASS}--done`);
      btn.innerHTML = ICON_DONE;
      btn.title = 'Сохранено';
    } catch (err) {
      console.error('[VKify] Pin note failed:', err);
      btn.title = 'Не удалось сохранить';
      return;
    }

    setTimeout(() => {
      btn.classList.remove(`${BTN_CLASS}--done`);
      btn.innerHTML = ICON_PIN;
      btn.title = 'Сохранить в заметки';
    }, 1400);
  });

  btn.addEventListener('mousedown', e => e.preventDefault());
  return btn;
}
