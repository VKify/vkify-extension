/** Кнопка «прикрепить как заметку»: по клику сохраняет сообщение в архив. */

import type { PinnedNote } from '@/types/index.js';
import { extractMessageText, extractAuthor, extractTime } from '../_shared/message-dom.js';
import { extractNoteAuthor } from './author.js';
import { detectPeerId, detectPeerTitle, extractCmid } from './peer.js';
import { appendNote, makeId } from './notes.js';
import { ICON_PIN, ICON_DONE } from './icons.js';
import { BTN_CLASS } from './constants.js';
import { t } from '@/content/i18n/index.js';
import { setTrustedHtml } from '@/content/utils/trusted-html.js';
import { getService, SERVICES } from '@/content/core/services/index.js';
import { detectConversationContext } from '../dialog-export/peer.js';
import type { VKMessage } from '../dialog-export/types.js';
import { domAttachments, messageAttachments } from './attachments.js';

export function makeButton(messageBlock: Element): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = BTN_CLASS;
  btn.title = t('messages.pin_note.save');
  btn.setAttribute('aria-label', t('messages.pin_note.aria'));
  setTrustedHtml(btn, ICON_PIN);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (btn.disabled) return;
    const text = extractMessageText(messageBlock);

    const note: PinnedNote = {
      id: makeId(),
      text,
      author: extractAuthor(messageBlock) || undefined,
      ...extractNoteAuthor(messageBlock),
      origTime: extractTime(messageBlock) || undefined,
      peerId: detectPeerId() ?? undefined,
      peerTitle: detectPeerTitle() || undefined,
      cmid: extractCmid(messageBlock) ?? undefined,
      addedAt: Date.now(),
    };
    const context = detectConversationContext();
    note.peerId = context?.peerId ?? note.peerId;
    const sourceUrl = note.peerId !== undefined && note.cmid !== undefined
      ? `https://vk.ru/${context?.groupId ? `gim${context.groupId}` : 'im'}/convo/${note.peerId}?cmid=${note.cmid}` : undefined;
    const attachments = domAttachments(messageBlock);
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    try {
      // Read only this message, using its captured identity before any await.
      if (context && note.cmid !== undefined) {
        try {
          const response = await getService(SERVICES.vkApi).call('messages.getByConversationMessageId', {
            peer_id: context.peerId, conversation_message_ids: note.cmid,
            ...(context.groupId !== null ? { group_id: context.groupId } : {}),
          }) as { items?: VKMessage[] } | null;
          const message = response?.items?.find(item => item.conversation_message_id === note.cmid);
          if (message) {
            const fromApi = messageAttachments(message, sourceUrl);
            if (fromApi.length) attachments.splice(0, attachments.length, ...fromApi);
            note.text ||= message.text || '';
            note.authorId ??= message.from_id;
          }
        } catch { /* Visible attachments remain available without API access. */ }
      }
      if (!note.text && !attachments.length && sourceUrl) attachments.push({ type: 'link', url: sourceUrl });
      if (!note.text && !attachments.length) throw new Error('Message content unavailable');
      if (attachments.length) note.attachments = attachments;
      await appendNote(note);
      btn.classList.add(`${BTN_CLASS}--done`);
      setTrustedHtml(btn, ICON_DONE);
      btn.title = t('messages.pin_note.saved');
    } catch (err) {
      console.error('[VKify] Pin note failed:', err);
      btn.title = t('messages.pin_note.failed');
      return;
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }

    setTimeout(() => {
      btn.classList.remove(`${BTN_CLASS}--done`);
      setTrustedHtml(btn, ICON_PIN);
      btn.title = t('messages.pin_note.save');
    }, 1400);
  });

  btn.addEventListener('mousedown', e => e.preventDefault());
  return btn;
}
