/** Сборка содержимого экспорта: TXT, JSON и HTML (с поиском по сообщениям). */

import { escapeHtml, safeUrl } from '@/shared/utils/html.js';
import { authorAvatar, authorName, describeAttachment, formatDate } from './attachments.js';
import type { ConversationExportMeta, PeerNames, VKMessage } from './types.js';
import { t, getLang } from '@/content/i18n/index.js';

function renderMessageText(m: VKMessage, names: PeerNames, depth = 0): string {
  const pad = '  '.repeat(depth);
  const lines: string[] = [];
  lines.push(`${pad}[${formatDate(m.date)}] ${authorName(m.from_id, names)}: ${m.text || ''}`);
  for (const att of m.attachments ?? []) {
    const d = describeAttachment(att);
    if (d.textLine) lines.push(`${pad}  ${d.textLine}`);
  }
  if (m.reply_message) {
    lines.push(`${pad}  └─ ${t('messages.export.txt.reply')}`);
    lines.push(renderMessageText(m.reply_message, names, depth + 2));
  }
  for (const f of m.fwd_messages ?? []) {
    lines.push(`${pad}  └─ ${t('messages.export.txt.forward')}`);
    lines.push(renderMessageText(f, names, depth + 2));
  }
  if (m.action) {
    lines.push(`${pad}  ⚙ ${t('messages.export.txt.event')}: ${m.action.type}`);
  }
  return lines.join('\n');
}

export function buildTxt(title: string, messages: VKMessage[], names: PeerNames): string {
  const headerTitle = t('messages.export.txt.header_title', { title });
  const headerCount = t('messages.export.txt.header_count', { count: messages.length });
  const headerDate = t('messages.export.txt.header_date', { date: new Date().toLocaleString(getLang()) });
  const header = `${headerTitle}\n${headerCount}\n${headerDate}\n\n${'─'.repeat(60)}\n\n`;
  return header + messages.map(m => renderMessageText(m, names)).join('\n\n');
}

export function buildJson(
  title: string,
  peerId: number,
  messages: VKMessage[],
  names: PeerNames,
  groupId: number | null = null,
): string {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    title,
    peer_id: peerId,
    ...(groupId !== null ? { group_id: groupId } : {}),
    count: messages.length,
    profiles: Object.fromEntries(names.users),
    groups: Object.fromEntries(names.groups),
    messages,
  }, null, 2);
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]?.toUpperCase()).join('');
}

function localDayKey(ts: number): string {
  const date = new Date(ts * 1000);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDay(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(getLang(), {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(getLang(), {
    hour: '2-digit', minute: '2-digit',
  });
}

function renderAvatarHtml(fromId: number, names: PeerNames, className = 'avatar'): string {
  const name = authorName(fromId, names);
  const url = authorAvatar(fromId, names);
  return url
    ? `<span class="${className}"><img src="${escapeHtml(safeUrl(url))}" alt="" loading="lazy"></span>`
    : `<span class="${className} avatar--fallback" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

function renderAttachmentsHtml(message: VKMessage): string {
  const previews: string[] = [];
  const links: string[] = [];
  for (const attachment of message.attachments ?? []) {
    const descriptor = describeAttachment(attachment);
    if (descriptor.imageUrl) {
      const label = escapeHtml(descriptor.htmlLabel);
      previews.push(`
        <a class="media" href="${escapeHtml(safeUrl(descriptor.link ?? descriptor.imageUrl))}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeHtml(safeUrl(descriptor.imageUrl))}" alt="${label}" loading="lazy">
          ${attachment.type === 'video' ? `<span class="media__label">${label}</span>` : ''}
        </a>`);
    } else if (descriptor.htmlLabel) {
      const label = escapeHtml(descriptor.htmlLabel);
      links.push(descriptor.link
        ? `<a class="attachment" href="${escapeHtml(safeUrl(descriptor.link))}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : `<span class="attachment">${label}</span>`);
    }
  }
  return `${previews.length ? `<div class="media-grid${previews.length === 1 ? ' media-grid--single' : ''}">${previews.join('')}</div>` : ''}
    ${links.length ? `<div class="attachment-list">${links.join('')}</div>` : ''}`;
}

function renderQuoteHtml(message: VKMessage, names: PeerNames, label: string): string {
  const text = (message.text || '').split('\n').map(escapeHtml).join('<br>');
  return `
    <div class="quote">
      <div class="quote__label">${escapeHtml(label)}</div>
      <div class="quote__author">${escapeHtml(authorName(message.from_id, names))}</div>
      ${text ? `<div class="quote__text">${text}</div>` : ''}
      ${renderAttachmentsHtml(message)}
    </div>`;
}

function renderMessageHtml(
  message: VKMessage,
  names: PeerNames,
  meta: ConversationExportMeta,
): string {
  const outgoing = message.out === 1;
  const cmid = message.conversation_message_id;
  const read = outgoing && cmid !== undefined
    && meta.outReadCmid !== null && cmid <= meta.outReadCmid;
  const statusLabel = t(read ? 'messages.export.html.read' : 'messages.export.html.sent');
  const text = (message.text || '').split('\n').map(escapeHtml).join('<br>');
  const quotes = [
    message.reply_message
      ? renderQuoteHtml(message.reply_message, names, t('messages.export.html.reply'))
      : '',
    ...(message.fwd_messages ?? []).map(forwarded =>
      renderQuoteHtml(forwarded, names, t('messages.export.html.forward')),
    ),
  ].join('');
  const action = message.action
    ? `<div class="message-action">⚙ ${escapeHtml(message.action.type)}</div>`
    : '';
  const dayKey = localDayKey(message.date);

  return `
    <article class="message ${outgoing ? 'message--out' : 'message--in'}" data-day="${dayKey}">
      ${renderAvatarHtml(message.from_id, names)}
      <div class="bubble">
        <div class="bubble__author">${escapeHtml(authorName(message.from_id, names))}</div>
        ${quotes}
        ${text ? `<div class="bubble__text">${text}</div>` : ''}
        ${renderAttachmentsHtml(message)}
        ${action}
        <div class="bubble__footer">
          <time datetime="${new Date(message.date * 1000).toISOString()}" title="${escapeHtml(formatDate(message.date))}">${escapeHtml(formatTime(message.date))}</time>
          ${outgoing ? `<span class="delivery${read ? ' delivery--read' : ''}" title="${escapeHtml(statusLabel)}" aria-label="${escapeHtml(statusLabel)}">${read ? '✓✓' : '✓'}</span>` : ''}
        </div>
      </div>
    </article>`;
}

function pickHeaderAuthor(messages: VKMessage[]): number | null {
  return messages.find(message => message.out !== 1)?.from_id
    ?? messages[0]?.from_id
    ?? null;
}

export function buildHtml(
  title: string,
  messages: VKMessage[],
  names: PeerNames,
  meta: ConversationExportMeta = { outReadCmid: null },
): string {
  let previousDay = '';
  const body: string[] = [];
  for (const message of messages) {
    const dayKey = localDayKey(message.date);
    if (dayKey !== previousDay) {
      body.push(`<div class="day-separator" data-day-separator="${dayKey}"><span>${escapeHtml(formatDay(message.date))}</span></div>`);
      previousDay = dayKey;
    }
    body.push(renderMessageHtml(message, names, meta));
  }
  const safeTitle = escapeHtml(title);
  const lang = getLang();
  const now = new Date().toLocaleString(lang);
  const headerAuthor = pickHeaderAuthor(messages);
  const headerAvatar = headerAuthor === null
    ? `<span class="chat-avatar avatar--fallback">${escapeHtml(initials(title))}</span>`
    : renderAvatarHtml(headerAuthor, names, 'chat-avatar');
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(t('messages.export.html.doc_title', { title }))}</title>
  <script>
    try {
      var savedTheme = localStorage.getItem('vkify-export-theme');
      document.documentElement.dataset.theme = savedTheme === 'dark' || savedTheme === 'light'
        ? savedTheme
        : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (_) { document.documentElement.dataset.theme = 'light'; }
  </script>
  <style>
    :root, html[data-theme="light"] {
      color-scheme: light;
      --page:#edeef0; --chat:#eef1f5; --header:#fff; --panel:#fff;
      --incoming:#fff; --outgoing:#dff0ff; --text:#1f2a37; --muted:#7b8794;
      --accent:#2688eb; --out-author:#1976d2; --read:#2688eb; --line:#dce1e6;
      --quote:#edf4fb; --input:#f2f3f5;
      --shadow:0 1px 2px rgba(20,36,50,.10);
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --page:#141414; --chat:#19191a; --header:#222222; --panel:#232324;
      --incoming:#232324; --outgoing:#263c54; --text:#e1e3e6; --muted:#909499;
      --accent:#71aaeb; --out-author:#8ac7ff; --read:#71aaeb; --line:#363738;
      --quote:#2a2a2b; --input:#292929;
      --shadow:0 1px 2px rgba(0,0,0,.28);
    }
    * { box-sizing:border-box; }
    html, body { min-height:100%; }
    body { margin:0; background:var(--page); color:var(--text); font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
    button,input { font:inherit; }
    .chat-shell { width:min(100%, 980px); min-height:100vh; margin:0 auto; background:var(--chat); box-shadow:0 0 24px rgba(0,0,0,.12); }
    .chat-header { position:sticky; top:0; z-index:10; display:flex; align-items:center; gap:12px; min-height:68px; padding:10px 16px; background:var(--header); border-bottom:1px solid var(--line); box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .chat-avatar,.avatar { flex:0 0 auto; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:50%; background:#7d8f9b; color:#fff; font-size:11px; font-weight:700; }
    .chat-avatar { width:44px; height:44px; font-size:13px; }
    .avatar { width:34px; height:34px; margin-top:2px; }
    .chat-avatar img,.avatar img { width:100%; height:100%; object-fit:cover; }
    .chat-heading { min-width:0; flex:1; }
    h1 { margin:0; overflow:hidden; font-size:17px; line-height:1.25; text-overflow:ellipsis; white-space:nowrap; }
    .stat { margin-top:3px; color:var(--muted); font-size:11px; }
    .chat-controls { display:flex; align-items:center; gap:8px; }
    .search { width:clamp(150px,28vw,270px); }
    .search input { width:100%; min-height:38px; padding:8px 12px; border:1px solid transparent; border-radius:10px; outline:0; background:var(--input); color:var(--text); }
    .search input:focus { border-color:var(--accent); box-shadow:0 0 0 2px rgba(38,136,235,.12); }
    .theme-toggle { width:38px; height:38px; border:0; border-radius:50%; cursor:pointer; background:transparent; color:var(--muted); font-size:19px; }
    .theme-toggle:hover { background:rgba(127,127,127,.12); color:var(--text); }
    .chat-history { min-height:calc(100vh - 68px); padding:18px clamp(12px,5vw,58px) 34px; background:var(--chat); }
    .day-separator { display:flex; justify-content:center; margin:10px 0 14px; }
    .day-separator span { padding:5px 12px; border-radius:12px; background:var(--panel); color:var(--muted); box-shadow:var(--shadow); font-size:11px; font-weight:600; }
    .message { display:flex; align-items:flex-start; gap:9px; margin:7px 0; }
    .message--out { flex-direction:row-reverse; }
    .bubble { position:relative; min-width:92px; max-width:min(76%,680px); padding:10px 12px 7px; border-radius:5px 15px 15px; background:var(--incoming); box-shadow:var(--shadow); }
    .message--out .bubble { border-radius:15px 5px 15px 15px; background:var(--outgoing); }
    .bubble::after { content:""; display:block; clear:both; }
    .bubble__author { margin-bottom:2px; color:var(--accent); font-size:12px; font-weight:700; }
    .message--out .bubble__author { color:var(--out-author); }
    .bubble__text,.quote__text { white-space:pre-wrap; overflow-wrap:anywhere; }
    .bubble__footer { display:flex; float:right; align-items:center; gap:4px; margin:3px 0 -1px 12px; color:var(--muted); font-size:10px; line-height:16px; }
    .delivery { color:var(--muted); font-size:13px; letter-spacing:-3px; padding-right:3px; }
    .delivery--read { color:var(--read); }
    .quote { margin:3px 0 7px; padding:7px 9px; border-left:3px solid var(--accent); border-radius:6px; background:var(--quote); }
    .quote__label { color:var(--muted); font-size:9px; text-transform:uppercase; letter-spacing:.04em; }
    .quote__author { color:var(--accent); font-size:11px; font-weight:700; }
    .quote__text { max-height:4.5em; overflow:hidden; color:var(--muted); font-size:12px; }
    .media-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3px; margin:5px -4px 3px; overflow:hidden; border-radius:7px; }
    .media-grid--single { grid-template-columns:1fr; }
    .media { position:relative; display:block; min-width:0; background:rgba(127,127,127,.12); line-height:0; }
    .media img { display:block; width:100%; max-height:420px; object-fit:cover; }
    .media__label { position:absolute; left:7px; right:7px; bottom:7px; overflow:hidden; padding:5px 7px; border-radius:6px; background:rgba(0,0,0,.62); color:#fff; font-size:11px; line-height:1.3; text-overflow:ellipsis; white-space:nowrap; }
    .attachment-list { display:flex; flex-direction:column; gap:4px; margin-top:6px; }
    .attachment { padding:8px 10px; border-radius:7px; background:rgba(38,136,235,.09); color:var(--accent); font-size:12px; text-decoration:none; overflow-wrap:anywhere; }
    .attachment:hover { text-decoration:underline; }
    .message-action { margin-top:5px; color:var(--muted); font-size:11px; font-style:italic; }
    .message.is-hidden { display:none; }
    .search-empty {
      display:none; padding:48px 20px; text-align:center; color:var(--muted); font-size:13px;
    }
    .search-empty.is-visible { display:block; }
    @media (max-width:680px) {
      .chat-header { align-items:flex-start; flex-wrap:wrap; padding:9px 10px; }
      .chat-avatar { width:40px; height:40px; }
      .chat-controls { width:100%; }
      .search { flex:1; width:auto; }
      .chat-history { padding:12px 8px 28px; }
      .avatar { width:28px; height:28px; }
      .bubble { max-width:82%; }
      .media img { max-height:300px; }
    }
    @media print {
      html[data-theme] { --page:#fff; --chat:#eef1f5; --header:#fff; --panel:#fff; --incoming:#fff; --outgoing:#dff0ff; --text:#1f2a37; --muted:#7b8794; --line:#dce1e6; }
      .chat-shell { width:100%; box-shadow:none; }
      .chat-header { position:static; }
      .chat-controls { display:none; }
      .message,.day-separator { break-inside:avoid; page-break-inside:avoid; }
    }
  </style>
</head>
<body>
  <div class="chat-shell">
    <header class="chat-header">
      ${headerAvatar}
      <div class="chat-heading">
        <h1>${safeTitle}</h1>
        <div class="stat">${escapeHtml(t('messages.export.html.stat', { count: messages.length, date: now }))}</div>
      </div>
      <div class="chat-controls">
        <label class="search">
          <input id="vkify-search" type="search" aria-label="${escapeHtml(t('messages.export.html.search_placeholder'))}" placeholder="${escapeHtml(t('messages.export.html.search_placeholder'))}" autocomplete="off">
        </label>
        <button class="theme-toggle" id="vkify-theme" type="button" aria-label="${escapeHtml(t('messages.export.html.theme'))}">◐</button>
      </div>
    </header>
    <main class="chat-history">
      <div class="search-empty" id="vkify-empty">${escapeHtml(t('messages.export.html.not_found'))}</div>
      ${body.join('\n')}
    </main>
  </div>
  <script>
    (function () {
      var input = document.getElementById('vkify-search');
      var empty = document.getElementById('vkify-empty');
      var nodes = Array.prototype.slice.call(document.querySelectorAll('.message'));
      var separators = Array.prototype.slice.call(document.querySelectorAll('[data-day-separator]'));
      var texts = nodes.map(function (n) { return (n.innerText || '').toLowerCase(); });
      var timer = 0;
      function apply() {
        var q = input.value.trim().toLowerCase();
        var shown = 0;
        var visibleDays = Object.create(null);
        for (var i = 0; i < nodes.length; i++) {
          var hit = !q || texts[i].indexOf(q) !== -1;
          nodes[i].classList.toggle('is-hidden', !hit);
          if (hit) { shown++; visibleDays[nodes[i].getAttribute('data-day')] = true; }
        }
        for (var j = 0; j < separators.length; j++) {
          separators[j].hidden = !visibleDays[separators[j].getAttribute('data-day-separator')];
        }
        empty.classList.toggle('is-visible', q && shown === 0);
      }
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(apply, 80);
      });

      var themeButton = document.getElementById('vkify-theme');
      var lightLabel = ${JSON.stringify(t('messages.export.html.theme_light'))};
      var darkLabel = ${JSON.stringify(t('messages.export.html.theme_dark'))};
      function syncThemeButton() {
        var dark = document.documentElement.dataset.theme === 'dark';
        themeButton.textContent = dark ? '☀' : '☾';
        themeButton.title = dark ? lightLabel : darkLabel;
      }
      themeButton.addEventListener('click', function () {
        var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('vkify-export-theme', next); } catch (_) {}
        syncThemeButton();
      });
      syncThemeButton();
    })();
  </script>
</body>
</html>`;
}
