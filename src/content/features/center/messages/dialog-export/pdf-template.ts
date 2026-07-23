import { authorAvatar, authorName, describeAttachment, formatDate } from './attachments.js';
import type { ConversationExportMeta, PeerNames, VKMessage } from './types.js';
import { getLang, t } from '@/content/i18n/index.js';
import { safeUrl } from '@/shared/utils/html.js';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');
}

function renderAttachments(message: VKMessage): HTMLElement | null {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) return null;
  const wrap = el('div', 'pdf-atts');

  for (const attachment of attachments) {
    const descriptor = describeAttachment(attachment);
    if (descriptor.imageUrl) {
      const target = descriptor.link ?? descriptor.imageUrl;
      const link = el('a', 'pdf-preview');
      link.href = safeUrl(target);
      const image = el('img');
      image.src = safeUrl(descriptor.imageUrl);
      image.alt = descriptor.htmlLabel;
      link.appendChild(image);
      if (attachment.type === 'video') link.appendChild(el('span', 'pdf-preview-label', descriptor.htmlLabel));
      wrap.appendChild(link);
      continue;
    }

    if (!descriptor.htmlLabel) continue;
    const item = descriptor.link ? el('a', 'pdf-attachment-link') : el('span', 'pdf-attachment-link');
    item.textContent = descriptor.htmlLabel;
    if (item instanceof HTMLAnchorElement && descriptor.link) item.href = safeUrl(descriptor.link);
    wrap.appendChild(item);
  }
  return wrap.childElementCount ? wrap : null;
}

function renderQuoted(message: VKMessage, names: PeerNames, label: string): HTMLElement {
  const quote = el('div', 'pdf-quote');
  quote.appendChild(el('div', 'pdf-quote-label', label));
  quote.appendChild(el('div', 'pdf-quote-meta', `${authorName(message.from_id, names)} · ${formatDate(message.date)}`));
  if (message.text) quote.appendChild(el('div', 'pdf-text', message.text));
  const attachments = renderAttachments(message);
  if (attachments) quote.appendChild(attachments);
  return quote;
}

function renderMessage(
  message: VKMessage,
  names: PeerNames,
  meta: ConversationExportMeta,
): HTMLElement {
  const name = authorName(message.from_id, names);
  const row = el('div', `pdf-message ${message.out === 1 ? 'pdf-message--out' : 'pdf-message--in'}`);

  const avatar = el('div', 'pdf-avatar');
  const avatarUrl = authorAvatar(message.from_id, names);
  if (avatarUrl) {
    const image = el('img');
    image.src = safeUrl(avatarUrl);
    image.alt = '';
    avatar.appendChild(image);
  } else {
    avatar.textContent = initials(name);
  }

  const bubble = el('div', 'pdf-bubble');
  const metaRow = el('div', 'pdf-meta');
  metaRow.appendChild(el('span', 'pdf-author', name));
  bubble.appendChild(metaRow);
  if (message.text) bubble.appendChild(el('div', 'pdf-text', message.text));

  const attachments = renderAttachments(message);
  if (attachments) bubble.appendChild(attachments);
  if (message.reply_message) {
    bubble.appendChild(renderQuoted(message.reply_message, names, t('messages.export.html.reply')));
  }
  for (const forwarded of message.fwd_messages ?? []) {
    bubble.appendChild(renderQuoted(forwarded, names, t('messages.export.html.forward')));
  }
  if (message.action) bubble.appendChild(el('div', 'pdf-action', `⚙ ${message.action.type}`));

  const footer = el('div', 'pdf-footer');
  footer.title = formatDate(message.date);
  footer.appendChild(el('span', 'pdf-date', new Date(message.date * 1000).toLocaleTimeString(getLang(), {
    hour: '2-digit', minute: '2-digit',
  })));
  if (message.out === 1) {
    const cmid = message.conversation_message_id;
    const read = cmid !== undefined && meta.outReadCmid !== null && cmid <= meta.outReadCmid;
    footer.appendChild(el('span', read ? 'pdf-status pdf-status--read' : 'pdf-status', read ? '✓✓' : '✓'));
  }
  bubble.appendChild(footer);

  row.append(avatar, bubble);
  return row;
}

export const PDF_CSS = `
  .vkify-pdf-document { box-sizing:border-box; width:718px; padding:28px; background:#eef1f5; color:#1f2a37; font:14px/1.45 Arial, sans-serif; }
  .pdf-cover { padding:24px; margin-bottom:20px; border-radius:18px; color:#fff; background:linear-gradient(135deg,#2688eb,#5b6ee1); page-break-inside:avoid; }
  .pdf-cover h1 { margin:0 0 6px; font-size:25px; line-height:1.2; }
  .pdf-cover p { margin:0; opacity:.86; font-size:12px; }
  .pdf-day { margin:18px 0 10px; text-align:center; color:#6b7280; font-size:11px; font-weight:700; }
  .pdf-day span { display:inline-block; padding:4px 10px; border-radius:12px; background:#dfe5ec; }
  .pdf-message { display:flex; gap:9px; align-items:flex-start; margin:0 0 10px; page-break-inside:avoid; break-inside:avoid; }
  .pdf-message--out { flex-direction:row-reverse; }
  .pdf-avatar { width:34px; height:34px; flex:0 0 34px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#9aa9bc; color:#fff; font-size:11px; font-weight:700; }
  .pdf-avatar img { width:100%; height:100%; object-fit:cover; }
  .pdf-bubble { box-sizing:border-box; max-width:560px; padding:10px 12px; border-radius:5px 15px 15px; background:#fff; box-shadow:0 1px 2px rgba(20,36,50,.1); }
  .pdf-bubble::after { content:""; display:block; clear:both; }
  .pdf-message--out .pdf-bubble { border-radius:15px 5px 15px 15px; background:#dff0ff; }
  .pdf-meta { margin-bottom:4px; }
  .pdf-author { color:#1976d2; font-size:12px; font-weight:700; }
  .pdf-date { color:#7b8794; font-size:9px; white-space:nowrap; }
  .pdf-footer { display:flex; float:right; align-items:center; gap:4px; margin:4px 0 -2px 12px; }
  .pdf-status { color:#7b8794; font-size:11px; letter-spacing:-3px; padding-right:3px; }
  .pdf-status--read { color:#249bd7; }
  .pdf-text { white-space:pre-wrap; overflow-wrap:anywhere; }
  .pdf-atts { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .pdf-preview { position:relative; display:block; max-width:100%; color:#fff; text-decoration:none; }
  .pdf-preview img { display:block; max-width:100%; max-height:260px; object-fit:contain; border-radius:9px; background:#e5e7eb; }
  .pdf-preview-label { position:absolute; left:7px; bottom:7px; max-width:90%; padding:3px 7px; border-radius:7px; background:rgba(0,0,0,.64); font-size:10px; }
  .pdf-attachment-link { display:block; max-width:100%; padding:6px 9px; border-radius:8px; background:#edf4fb; color:#1769aa; font-size:11px; text-decoration:none; overflow-wrap:anywhere; }
  .pdf-quote { margin-top:8px; padding:7px 9px; border-left:3px solid #75a7d8; border-radius:4px; background:rgba(255,255,255,.56); }
  .pdf-quote-label,.pdf-quote-meta,.pdf-action { color:#6b7280; font-size:10px; }
  .pdf-quote-meta { margin-bottom:3px; font-weight:700; }
  .pdf-action { margin-top:6px; font-style:italic; }
`;

export function buildPdfDocument(
  title: string,
  messages: VKMessage[],
  names: PeerNames,
  meta: ConversationExportMeta = { outReadCmid: null },
): HTMLElement {
  const root = el('section', 'vkify-pdf-document');
  const style = document.createElement('style');
  style.textContent = PDF_CSS;
  root.appendChild(style);

  const cover = el('header', 'pdf-cover');
  cover.appendChild(el('h1', '', title));
  cover.appendChild(el('p', '', t('messages.export.pdf.meta', {
    count: messages.length,
    date: new Date().toLocaleString(getLang()),
  })));
  root.appendChild(cover);

  let previousDay = '';
  for (const message of messages) {
    const day = new Date(message.date * 1000).toLocaleDateString(getLang(), {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    if (day !== previousDay) {
      const separator = el('div', 'pdf-day');
      separator.appendChild(el('span', '', day));
      root.appendChild(separator);
      previousDay = day;
    }
    root.appendChild(renderMessage(message, names, meta));
  }
  return root;
}
