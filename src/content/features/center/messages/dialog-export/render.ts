/** Сборка содержимого экспорта: TXT, JSON и HTML (с поиском по сообщениям). */

import { escapeHtml, safeUrl } from '../../../../../shared/utils/html.js';
import { authorName, describeAttachment, formatDate } from './attachments.js';
import type { PeerNames, VKMessage } from './types.js';

function renderMessageText(m: VKMessage, names: PeerNames, depth = 0): string {
  const pad = '  '.repeat(depth);
  const lines: string[] = [];
  lines.push(`${pad}[${formatDate(m.date)}] ${authorName(m.from_id, names)}: ${m.text || ''}`);
  for (const att of m.attachments ?? []) {
    const d = describeAttachment(att);
    if (d.textLine) lines.push(`${pad}  ${d.textLine}`);
  }
  if (m.reply_message) {
    lines.push(`${pad}  └─ в ответ на:`);
    lines.push(renderMessageText(m.reply_message, names, depth + 2));
  }
  for (const f of m.fwd_messages ?? []) {
    lines.push(`${pad}  └─ переслано:`);
    lines.push(renderMessageText(f, names, depth + 2));
  }
  if (m.action) {
    lines.push(`${pad}  ⚙ событие: ${m.action.type}`);
  }
  return lines.join('\n');
}

export function buildTxt(title: string, messages: VKMessage[], names: PeerNames): string {
  const header = `Экспорт диалога «${title}»\nСообщений: ${messages.length}\nЭкспортировано: ${new Date().toLocaleString('ru-RU')}\n\n${'─'.repeat(60)}\n\n`;
  return header + messages.map(m => renderMessageText(m, names)).join('\n\n');
}

export function buildJson(title: string, peerId: number, messages: VKMessage[], names: PeerNames): string {
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    title,
    peer_id: peerId,
    count: messages.length,
    profiles: Object.fromEntries(names.users),
    groups: Object.fromEntries(names.groups),
    messages,
  }, null, 2);
}

function renderMessageHtml(m: VKMessage, names: PeerNames, depth = 0): string {
  const cls = depth === 0 ? 'msg' : 'msg msg--nested';

  // Прямые URL картинок — разумный дефолт: base64-встраивание раздувает файл
  // в десятки раз, для него есть отдельный формат HTML+.
  const imgs = (m.attachments ?? [])
    .map(a => describeAttachment(a))
    .filter(d => d.imageUrl)
    .map(d => `<a class="img-link" href="${escapeHtml(safeUrl(d.link ?? d.imageUrl!))}" target="_blank" rel="noopener noreferrer"><img class="att-img" loading="lazy" src="${escapeHtml(safeUrl(d.imageUrl!))}" alt=""></a>`)
    .join('');

  const otherAtts = (m.attachments ?? [])
    .map(a => describeAttachment(a))
    .filter(d => !d.imageUrl && d.htmlLabel)
    .map(d => d.link
      ? `<a class="att" href="${escapeHtml(safeUrl(d.link))}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.htmlLabel)}</a>`
      : `<span class="att">${escapeHtml(d.htmlLabel)}</span>`)
    .join('');

  const text = (m.text || '').split('\n').map(escapeHtml).join('<br>');

  let nested = '';
  if (m.reply_message) {
    nested += `<div class="quoted"><div class="quoted-label">↰ В ответ на</div>${renderMessageHtml(m.reply_message, names, depth + 1)}</div>`;
  }
  for (const f of m.fwd_messages ?? []) {
    nested += `<div class="quoted"><div class="quoted-label">↳ Переслано</div>${renderMessageHtml(f, names, depth + 1)}</div>`;
  }
  const action = m.action ? `<div class="action">⚙ ${escapeHtml(m.action.type)}</div>` : '';

  return `
    <div class="${cls}">
      <div class="meta">
        <span class="author">${escapeHtml(authorName(m.from_id, names))}</span>
        <span class="date">${escapeHtml(formatDate(m.date))}</span>
      </div>
      <div class="text">${text}</div>
      ${imgs ? `<div class="imgs">${imgs}</div>` : ''}
      ${otherAtts ? `<div class="atts">${otherAtts}</div>` : ''}
      ${action}
      ${nested}
    </div>`;
}

export function buildHtml(title: string, messages: VKMessage[], names: PeerNames): string {
  const body = messages.map(m => renderMessageHtml(m, names)).join('\n');
  const safeTitle = escapeHtml(title);
  const now = escapeHtml(new Date().toLocaleString('ru-RU'));
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Диалог: ${safeTitle}</title>
  <style>
    body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f8fa; color: #2c2d2e; margin: 0; padding: 24px; }
    .wrap { max-width: 760px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .stat { color: #818c99; font-size: 12px; margin-bottom: 24px; }
    .msg { background: #fff; border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
    .msg--nested { background: #f0f3f7; box-shadow: none; margin-top: 6px; margin-bottom: 0; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
    .author { font-weight: 600; color: #0077ff; }
    .date { color: #818c99; }
    .text { white-space: pre-wrap; word-break: break-word; }
    .imgs { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
    .img-link { display: block; line-height: 0; }
    .att-img {
      max-width: 360px; max-height: 360px;
      width: auto; height: auto;
      border-radius: 8px;
      cursor: zoom-in;
      background: rgba(0,0,0,0.04);
    }
    .atts { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; }
    .att { font-size: 11px; padding: 3px 8px; border-radius: 4px; background: rgba(0,119,255,0.12); color: #0077ff; text-decoration: none; }
    .att:hover { background: rgba(0,119,255,0.22); }
    .action { margin-top: 4px; font-size: 12px; color: #818c99; font-style: italic; }
    .quoted { border-left: 3px solid #d9dde2; margin-top: 6px; padding-left: 8px; }
    .quoted-label { font-size: 11px; color: #818c99; margin-bottom: 2px; }
    @media (prefers-color-scheme: dark) {
      body { background: #19191a; color: #e1e3e6; }
      .msg { background: #232324; box-shadow: none; }
      .msg--nested { background: #2a2a2b; }
      .date, .quoted-label, .action, .stat { color: #909499; }
      .author { color: #4c9aff; }
      .att { background: rgba(76,154,255,0.18); color: #4c9aff; }
      .quoted { border-color: #3a3a3b; }
      .search input { background: #2a2a2b; color: #e1e3e6; border-color: #3a3a3b; }
      .search-empty { color: #909499; }
    }
    .search {
      position: sticky; top: 0; z-index: 5;
      padding: 10px 0;
      background: linear-gradient(to bottom, #f7f8fa 80%, transparent);
      margin-bottom: 8px;
    }
    @media (prefers-color-scheme: dark) {
      .search { background: linear-gradient(to bottom, #19191a 80%, transparent); }
    }
    .search input {
      width: 100%;
      padding: 9px 12px;
      font: inherit; font-size: 13px;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 8px;
      background: #fff;
      color: inherit;
      box-sizing: border-box;
      outline: none;
    }
    .search input:focus { border-color: #0077ff; }
    .msg.is-hidden { display: none; }
    .search-empty {
      display: none;
      padding: 24px;
      text-align: center;
      color: #818c99;
      font-size: 13px;
    }
    .search-empty.is-visible { display: block; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${safeTitle}</h1>
    <div class="stat">Сообщений: ${messages.length} · Экспортировано: ${now}</div>
    <div class="search">
      <input id="vkify-search" type="search" placeholder="Поиск по сообщениям…" autocomplete="off">
    </div>
    <div class="search-empty" id="vkify-empty">Ничего не найдено</div>
    ${body}
  </div>
  <script>
    (function () {
      var input = document.getElementById('vkify-search');
      var empty = document.getElementById('vkify-empty');
      var nodes = Array.prototype.slice.call(document.querySelectorAll('.msg:not(.msg--nested)'));
      // Кэшируем lower-case текст каждого блока — пересоздавать его на каждый
      // keystroke было бы расточительно на больших чатах.
      var texts = nodes.map(function (n) { return (n.innerText || '').toLowerCase(); });
      var timer = 0;
      function apply() {
        var q = input.value.trim().toLowerCase();
        var shown = 0;
        for (var i = 0; i < nodes.length; i++) {
          var hit = !q || texts[i].indexOf(q) !== -1;
          nodes[i].classList.toggle('is-hidden', !hit);
          if (hit) shown++;
        }
        empty.classList.toggle('is-visible', q && shown === 0);
      }
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(apply, 80);
      });
    })();
  </script>
</body>
</html>`;
}
