/** Кнопка копирования: обычный клик — одно сообщение, Shift+клик — диапазон. */

import { extractMessageText } from '../_shared/message-dom.js';
import { copyToClipboard } from './clipboard.js';
import { handleShiftClick } from './bulk.js';
import { ICON_COPY, ICON_DONE } from './icons.js';
import { BTN_CLASS } from './constants.js';

export function makeButton(messageBlock: Element): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BTN_CLASS;
  btn.title = 'Копировать (Shift+клик — выбрать диапазон)';
  btn.setAttribute('aria-label', 'Копировать текст сообщения');
  btn.innerHTML = ICON_COPY;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Shift-клик: первый отмечает якорь, второй копирует диапазон.
    if (e.shiftKey) {
      await handleShiftClick(messageBlock, btn);
      return;
    }

    // Обычный клик — текст одного сообщения.
    const text = extractMessageText(messageBlock);
    const ok = await copyToClipboard(text);

    btn.classList.add(`${BTN_CLASS}--done`);
    btn.innerHTML = ICON_DONE;
    btn.title = ok ? 'Скопировано' : 'Не удалось скопировать';

    setTimeout(() => {
      btn.classList.remove(`${BTN_CLASS}--done`);
      btn.innerHTML = ICON_COPY;
      btn.title = 'Копировать (Shift+клик — выбрать диапазон)';
    }, 1200);
  });

  btn.addEventListener('mousedown', e => e.preventDefault());
  return btn;
}
