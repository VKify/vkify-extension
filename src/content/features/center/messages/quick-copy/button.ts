/** Кнопка копирования: обычный клик — одно сообщение, Shift+клик — диапазон. */

import { extractMessageText } from '../_shared/message-dom.js';
import { copyToClipboard } from './clipboard.js';
import { handleShiftClick } from './bulk.js';
import { ICON_COPY, ICON_DONE } from './icons.js';
import { BTN_CLASS } from './constants.js';
import { t } from '@/content/i18n/index.js';
import { setTrustedHtml } from '@/content/utils/trusted-html.js';

export function makeButton(messageBlock: Element): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BTN_CLASS;
  btn.title = t('messages.quick_copy.copy');
  btn.setAttribute('aria-label', t('messages.quick_copy.aria'));
  setTrustedHtml(btn, ICON_COPY);

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
    setTrustedHtml(btn, ICON_DONE);
    btn.title = ok ? t('messages.quick_copy.copied') : t('messages.quick_copy.failed');

    setTimeout(() => {
      btn.classList.remove(`${BTN_CLASS}--done`);
      setTrustedHtml(btn, ICON_COPY);
      btn.title = t('messages.quick_copy.copy');
    }, 1200);
  });

  btn.addEventListener('mousedown', e => e.preventDefault());
  return btn;
}
