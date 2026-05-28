import type { FeatureManager } from '../../core/feature-manager.js';
import { vkApi } from '../../api/vk-api-client.js';
import { buildZip, type ZipEntry } from '../../../shared/utils/zip.js';
import { coffeeTryDecrypt, vkifyTryDecrypt } from '../privacy/message-crypto-core.js';

/**
 * Экспорт текущего диалога в файл (JSON / TXT / HTML).
 *
 * В шапку чата (ConvoHeader__controls) добавляется кнопка «скачать».
 * При клике открывается мини-меню с тремя форматами. После выбора:
 *   1. Резолвится peer_id (URL → DOM-фолбэк).
 *   2. Через messages.getHistory с extended=1 фетчится вся история чата
 *      постранично (200 за вызов), с паузой ~340 мс между запросами,
 *      чтобы не упереться в rate-limit VK API (≈3 rps).
 *   3. Профили/группы из ответов сливаются в одну map для красивых имён.
 *   4. По формату выбирается рендер и через <a download> с Blob-URL
 *      инициируется скачивание (без вовлечения background).
 *
 * Ограничение: API возвращает максимум 200 сообщений за вызов; для очень
 * больших чатов экспорт может занять несколько минут — поэтому показываем
 * прогресс-оверлей с кнопкой отмены.
 */

const BTN_ATTR  = 'data-vkify-export-injected';
const STYLE_ID  = 'vkify-export-styles';
const ROOT_ID   = 'vkify-export-overlay';

const CHAT_PEER_OFFSET = 2_000_000_000;
const PAGE_SIZE        = 200;
const REQUEST_DELAY_MS = 340;

type ExportFormat = 'json' | 'txt' | 'html' | 'html-embed' | 'html-zip';

/** Параллельность скачивания картинок при HTML+base64. Выше — быстрее, но
 *  больше шансов упереться в connection limit или rate-limit CDN. */
const EMBED_CONCURRENCY = 6;
/** Жёсткий потолок: картинки больше 8 МБ не встраиваем (HTML распух бы),
 *  остаются прямой ссылкой. */
const EMBED_MAX_BYTES = 8 * 1024 * 1024;

interface VKMessage {
  id: number;
  date: number;
  from_id: number;
  peer_id: number;
  text: string;
  fwd_messages?: VKMessage[];
  reply_message?: VKMessage;
  attachments?: VKAttachment[];
  action?: { type: string; [k: string]: unknown };
}

interface VKPhotoSize { type: string; url: string; width: number; height: number }
interface VKPhoto     { id: number; owner_id: number; sizes: VKPhotoSize[]; text?: string }
interface VKDoc       { id: number; title?: string; url?: string; ext?: string; size?: number }
interface VKSticker   { sticker_id: number; images?: VKPhotoSize[]; images_with_background?: VKPhotoSize[] }
interface VKAudio     { artist?: string; title?: string; url?: string; duration?: number }
interface VKVideo     { id: number; owner_id: number; title?: string; image?: VKPhotoSize[]; duration?: number }
interface VKLink      { url: string; title?: string; description?: string }

interface VKAttachment {
  type: string;
  photo?:   VKPhoto;
  doc?:     VKDoc;
  sticker?: VKSticker;
  audio?:   VKAudio;
  video?:   VKVideo;
  link?:    VKLink;
  audio_message?: { link_ogg?: string; link_mp3?: string; duration?: number };
  [k: string]: unknown;
}

interface VKProfile {
  id: number;
  first_name: string;
  last_name: string;
  screen_name?: string;
}

interface VKGroup {
  id: number;
  name: string;
  screen_name?: string;
}

interface HistoryResponse {
  count: number;
  items: VKMessage[];
  profiles?: VKProfile[];
  groups?: VKGroup[];
}

interface PeerNames {
  users: Map<number, VKProfile>;
  groups: Map<number, VKGroup>;
}

const STYLE_CSS = `
  .vkify-export-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    color: var(--vkui--color_icon_secondary, #818c99);
    transition: background 0.12s ease, color 0.12s ease;
  }
  .vkify-export-btn:hover {
    background: var(--vkui--color_background_secondary_alpha, rgba(0,0,0,0.06));
    color: var(--vkui--color_icon_primary, #2c2d2e);
  }
  .vkify-export-btn svg { width: 22px; height: 22px; pointer-events: none; }

  .vkify-export-menu {
    position: fixed;
    z-index: 2147483646;
    min-width: 200px;
    background: var(--vkui--color_background_modal, #fff);
    color: var(--vkui--color_text_primary, #2c2d2e);
    border-radius: 10px;
    box-shadow: 0 10px 32px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06);
    padding: 6px;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .vkify-export-menu button {
    display: flex; align-items: center; gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    color: inherit;
    text-align: left;
    font: inherit;
  }
  .vkify-export-menu button:hover {
    background: var(--vkui--color_background_secondary_alpha, rgba(0,0,0,0.06));
  }
  .vkify-export-menu .vkify-fmt {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0,119,255,0.12);
    color: #0077ff;
    letter-spacing: 0.04em;
  }
  .vkify-export-menu-sep {
    height: 1px;
    background: rgba(0,0,0,0.08);
    margin: 6px 4px;
  }
  .vkify-export-menu-opt {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    line-height: 1.3;
  }
  .vkify-export-menu-opt:hover {
    background: var(--vkui--color_background_secondary_alpha, rgba(0,0,0,0.06));
  }
  .vkify-export-menu-opt input {
    margin: 0;
    flex-shrink: 0;
    accent-color: #0077ff;
  }

  #${ROOT_ID} {
    position: fixed; inset: 0;
    z-index: 2147483647;
    background: rgba(0,0,0,0.55);
    display: flex; align-items: center; justify-content: center;
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  #${ROOT_ID} .vkify-export-card {
    width: 320px;
    background: var(--vkui--color_background_modal, #fff);
    color: var(--vkui--color_text_primary, #2c2d2e);
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 12px 36px rgba(0,0,0,0.25);
  }
  #${ROOT_ID} .vkify-export-title {
    font-weight: 600; font-size: 15px;
    margin-bottom: 4px;
  }
  #${ROOT_ID} .vkify-export-sub {
    font-size: 12px; opacity: 0.65;
    margin-bottom: 16px;
  }
  #${ROOT_ID} .vkify-export-bar {
    height: 6px;
    background: rgba(0,0,0,0.08);
    border-radius: 3px;
    overflow: hidden;
  }
  #${ROOT_ID} .vkify-export-fill {
    height: 100%;
    background: linear-gradient(90deg, #0077ff, #4c9aff);
    width: 0%;
    transition: width 0.2s ease;
  }
  #${ROOT_ID} .vkify-export-actions {
    margin-top: 14px;
    display: flex; justify-content: flex-end; gap: 8px;
  }
  #${ROOT_ID} button.vkify-export-cancel {
    background: transparent;
    border: none;
    padding: 6px 12px;
    border-radius: 8px;
    font: inherit;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
  }
  #${ROOT_ID} button.vkify-export-cancel:hover { background: rgba(0,0,0,0.06); opacity: 1; }
`;

const ICON_DOWNLOAD = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 4v12"/>
    <path d="m7 11 5 5 5-5"/>
    <path d="M4 20h16"/>
  </svg>
`;

// ─── peer / название чата ─────────────────────────────────────────────────

function detectPeerId(): number | null {
  // 1. URL query (старый IM)
  const sp = new URLSearchParams(location.search);
  const sel = sp.get('sel') ?? sp.get('peer');
  if (sel) {
    if (/^c\d+$/.test(sel)) return CHAT_PEER_OFFSET + Number(sel.slice(1));
    const n = Number(sel);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  // 2. URL path (новый messenger)
  const m = location.pathname.match(/\/im(?:\/convo)?\/(-?\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  // 3. DOM: ссылка-аватар в шапке
  const link = document.querySelector<HTMLAnchorElement>('.ConvoHeader__info');
  const href = link?.getAttribute('href') ?? '';
  let r: RegExpMatchArray | null;
  if ((r = href.match(/^\/id(\d+)/)))              return Number(r[1]);
  if ((r = href.match(/^\/(?:club|public)(\d+)/))) return -Number(r[1]);
  if ((r = href.match(/^\/im\?sel=c(\d+)/)))       return CHAT_PEER_OFFSET + Number(r[1]);
  if ((r = href.match(/^\/im\/convo\/(-?\d+)/)))   return Number(r[1]);
  return null;
}

function detectChatTitle(): string {
  const el =
    document.querySelector<HTMLElement>('.ConvoHeader .ConvoTitle__author') ||
    document.querySelector<HTMLElement>('.ConvoHeader .PeerTitle__title');
  return el?.getAttribute('title')?.trim() || el?.textContent?.trim() || 'dialog';
}

// ─── загрузка истории ─────────────────────────────────────────────────────

async function fetchAllHistory(
  peerId: number,
  onProgress: (loaded: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<{ messages: VKMessage[]; names: PeerNames }> {
  const messages: VKMessage[] = [];
  const users  = new Map<number, VKProfile>();
  const groups = new Map<number, VKGroup>();

  let offset = 0;
  let total  = 0;

  // Первый запрос — он же даёт нам total count.
  while (true) {
    if (isCancelled()) throw new Error('cancelled');

    const resp = await vkApi.call('messages.getHistory', {
      peer_id: peerId,
      count: PAGE_SIZE,
      offset,
      extended: 1,
    }) as HistoryResponse | null;

    if (!resp) break;

    if (offset === 0) total = resp.count;

    for (const p of resp.profiles ?? []) users.set(p.id, p);
    for (const g of resp.groups ?? [])   groups.set(g.id, g);

    if (!resp.items?.length) break;
    messages.push(...resp.items);

    onProgress(messages.length, total);

    if (messages.length >= total) break;
    if (resp.items.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  // VK отдаёт сообщения от свежих к старым — переворачиваем для хронологии.
  messages.reverse();
  return { messages, names: { users, groups } };
}

// ─── расшифровка сообщений на лету ────────────────────────────────────────

/**
 * Пробует расшифровать текст ключом из настроек обеими схемами по очереди:
 *   1. VKify E2E v2 (🔐 base64url 🔐, AES-256-GCM)
 *   2. COFFEE (PP/II/VK COFFEE/AP IDOG, AES-128-ECB)
 *
 * Если ни одна не сработала — возвращает оригинал. Тихо. Это экспорт,
 * а не интерактив, шуметь алертами не нужно.
 */
async function tryDecryptOne(text: string, key: string): Promise<string> {
  if (!text || !key) return text;
  const v = await vkifyTryDecrypt(text, key);
  if (v !== null) return v;
  const c = coffeeTryDecrypt(text, key);
  if (c !== null) return c;
  return text;
}

async function decryptAllInPlace(messages: VKMessage[], key: string): Promise<void> {
  if (!key) return;

  async function walk(m: VKMessage): Promise<void> {
    m.text = await tryDecryptOne(m.text, key);
    if (m.reply_message) await walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) await walk(f);
  }
  for (const m of messages) await walk(m);
}

// ─── base64-эмбеддинг картинок ────────────────────────────────────────────

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;

    // Гарантия: не подвешиваем гигабайтные картинки в DOM exported-файла.
    const lenHdr = Number(res.headers.get('content-length') || '0');
    if (lenHdr > EMBED_MAX_BYTES) return null;

    const blob = await res.blob();
    if (blob.size > EMBED_MAX_BYTES) return null;

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // CORS / сеть / экстеншен-context: оставляем прямую ссылку
    return null;
  }
}

/** Собирает все imageUrl из вложений (включая reply/fwd) и параллельно
 *  заменяет их на data:image/...;base64,... — с отчётом о прогрессе. */
async function embedAllImages(
  messages: VKMessage[],
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<void> {
  // 1. Собираем все вложения с прямой ссылкой на картинку.
  const targets: VKAttachment[] = [];
  function walk(m: VKMessage): void {
    for (const a of m.attachments ?? []) {
      const d = describeAttachment(a);
      if (d.imageUrl) targets.push(a);
    }
    if (m.reply_message) walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) walk(f);
  }
  for (const m of messages) walk(m);

  const total = targets.length;
  onProgress(0, total);
  if (total === 0) return;

  // 2. Скачиваем по EMBED_CONCURRENCY штук параллельно. Воркеры тянут
  //    задачи из общей очереди — без лишних аллокаций промисов на каждое
  //    превращение в data:URL.
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(EMBED_CONCURRENCY, total) }, async () => {
    while (next < total) {
      if (isCancelled()) return;
      const i = next++;
      const att = targets[i];
      const d = describeAttachment(att);
      const url = d.imageUrl;
      if (!url) { onProgress(++done, total); continue; }

      const dataUrl = await fetchAsDataUrl(url);
      if (dataUrl) {
        // Записываем data:URL прямо в исходный объект attachment,
        // чтобы describeAttachment в следующих вызовах вернул его.
        // Фото: подменяем url у самого крупного size; стикер — у крупного из images.
        injectDataUrl(att, url, dataUrl);
      }
      onProgress(++done, total);
    }
  });
  await Promise.all(workers);
}

function injectDataUrl(att: VKAttachment, originalUrl: string, dataUrl: string): void {
  const findAndReplace = (sizes?: VKPhotoSize[]): void => {
    if (!sizes) return;
    for (const s of sizes) {
      if (s.url === originalUrl) s.url = dataUrl;
    }
  };
  findAndReplace(att.photo?.sizes);
  findAndReplace(att.sticker?.images);
  findAndReplace(att.sticker?.images_with_background);
}

// ─── рендеры ──────────────────────────────────────────────────────────────

function authorName(fromId: number, names: PeerNames): string {
  if (fromId > 0) {
    const u = names.users.get(fromId);
    return u ? `${u.first_name} ${u.last_name}`.trim() : `id${fromId}`;
  }
  const g = names.groups.get(-fromId);
  return g ? g.name : `club${-fromId}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Самая большая по площади картинка из массива размеров. */
function pickLargest(sizes: VKPhotoSize[] | undefined): VKPhotoSize | null {
  if (!sizes?.length) return null;
  let best = sizes[0];
  for (const s of sizes) {
    if ((s.width * s.height) > (best.width * best.height)) best = s;
  }
  return best;
}

interface AttDescriptor {
  /** Короткая текстовая подпись для TXT-экспорта (с URL, если есть). */
  textLine: string;
  /** Прямой URL картинки для HTML-эмбеддинга (фото / стикер); null для остального. */
  imageUrl: string | null;
  /** Произвольная ссылка (для doc/audio/video/link), которую стоит вынести отдельной строкой. */
  link: string | null;
  /** Подпись для не-фото-вложений в HTML (например, «🎵 Артист — Трек»). */
  htmlLabel: string;
}

function describeAttachment(att: VKAttachment): AttDescriptor {
  const empty: AttDescriptor = { textLine: '', imageUrl: null, link: null, htmlLabel: '' };

  switch (att.type) {
    case 'photo': {
      const s = pickLargest(att.photo?.sizes);
      const url = s?.url ?? null;
      return {
        textLine: url ? `📷 фото: ${url}` : '📷 фото',
        imageUrl: url,
        link: url,
        htmlLabel: '📷 фото',
      };
    }
    case 'sticker': {
      const s = pickLargest(att.sticker?.images_with_background ?? att.sticker?.images);
      return {
        textLine: '🎨 стикер',
        imageUrl: s?.url ?? null,
        link: null,
        htmlLabel: '🎨 стикер',
      };
    }
    case 'doc': {
      const d = att.doc;
      const label = d?.title || `документ${d?.ext ? '.' + d.ext : ''}`;
      return {
        textLine: d?.url ? `📎 ${label}: ${d.url}` : `📎 ${label}`,
        imageUrl: null,
        link: d?.url ?? null,
        htmlLabel: `📎 ${label}`,
      };
    }
    case 'audio': {
      const a = att.audio;
      const label = `${a?.artist ?? ''} — ${a?.title ?? ''}`.trim().replace(/^—\s*|\s*—$/g, '');
      return {
        textLine: `🎵 ${label || 'аудио'}`,
        imageUrl: null,
        link: a?.url ?? null,
        htmlLabel: `🎵 ${label || 'аудио'}`,
      };
    }
    case 'audio_message': {
      const a = att.audio_message;
      const url = a?.link_mp3 ?? a?.link_ogg ?? null;
      return {
        textLine: url ? `🎤 голосовое: ${url}` : '🎤 голосовое',
        imageUrl: null,
        link: url,
        htmlLabel: '🎤 голосовое сообщение',
      };
    }
    case 'video': {
      const v = att.video;
      const title = v?.title || 'видео';
      const ownerId = v?.owner_id, vid = v?.id;
      const pageUrl = ownerId && vid ? `https://vk.com/video${ownerId}_${vid}` : null;
      return {
        textLine: pageUrl ? `🎬 ${title}: ${pageUrl}` : `🎬 ${title}`,
        imageUrl: null,
        link: pageUrl,
        htmlLabel: `🎬 ${title}`,
      };
    }
    case 'link': {
      const l = att.link;
      const label = l?.title || l?.url || 'ссылка';
      return {
        textLine: l?.url ? `🔗 ${label}: ${l.url}` : `🔗 ${label}`,
        imageUrl: null,
        link: l?.url ?? null,
        htmlLabel: `🔗 ${label}`,
      };
    }
    case 'wall':
    case 'wall_reply':
    case 'gift':
    case 'graffiti':
    case 'market':
    case 'poll':
    case 'call':
    default:
      return {
        ...empty,
        textLine: `[${att.type}]`,
        htmlLabel: `📌 ${att.type}`,
      };
  }
}

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

function buildTxt(title: string, messages: VKMessage[], names: PeerNames): string {
  const header = `Экспорт диалога «${title}»\nСообщений: ${messages.length}\nЭкспортировано: ${new Date().toLocaleString('ru-RU')}\n\n${'─'.repeat(60)}\n\n`;
  return header + messages.map(m => renderMessageText(m, names)).join('\n\n');
}

function buildJson(title: string, peerId: number, messages: VKMessage[], names: PeerNames): string {
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function renderMessageHtml(m: VKMessage, names: PeerNames, depth = 0): string {
  const cls = depth === 0 ? 'msg' : 'msg msg--nested';

  // Картинки фото/стикеров рендерим как <img loading="lazy"> с прямой ссылкой
  // на оригинал — браузер кэширует, в офлайне сломается; для прямо-в-файле
  // картинок придётся скачивать их в Blob → base64, что увеличит размер
  // экспорта в десятки раз. Прямые URL — разумный дефолт.
  const imgs = (m.attachments ?? [])
    .map(a => describeAttachment(a))
    .filter(d => d.imageUrl)
    .map(d => `<a class="img-link" href="${escapeHtml(d.link ?? d.imageUrl!)}" target="_blank" rel="noopener noreferrer"><img class="att-img" loading="lazy" src="${escapeHtml(d.imageUrl!)}" alt=""></a>`)
    .join('');

  const otherAtts = (m.attachments ?? [])
    .map(a => describeAttachment(a))
    .filter(d => !d.imageUrl && d.htmlLabel)
    .map(d => d.link
      ? `<a class="att" href="${escapeHtml(d.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.htmlLabel)}</a>`
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

function buildHtml(title: string, messages: VKMessage[], names: PeerNames): string {
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

// ─── download trigger ─────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 120);
}

function triggerDownload(content: string, filename: string, mime: string): void {
  triggerDownloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), filename);
}

function triggerDownloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── zip-сборка: HTML + папка /photos/ с оригиналами ──────────────────────

/** Расширение для имени файла, выводимое из Content-Type ответа. */
function extFromMime(mime: string | null): string {
  if (!mime) return 'jpg';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('png'))  return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif'))  return 'gif';
  return 'jpg';
}

async function buildZipArchive(
  title: string,
  messages: VKMessage[],
  names: PeerNames,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<Blob> {
  // 1. Собираем все картинки и присваиваем им позиционные имена 0001.jpg…,
  //    параллельно проставляя в att.photo.sizes[i].url относительный путь
  //    "photos/0001.jpg" — рендерер HTML возьмёт этот URL как есть.
  interface ImgJob { att: VKAttachment; originalUrl: string; localPath: string; }
  const jobs: ImgJob[] = [];

  function walk(m: VKMessage): void {
    for (const a of m.attachments ?? []) {
      const d = describeAttachment(a);
      if (d.imageUrl) {
        const idx = jobs.length + 1;
        const localPath = `photos/${String(idx).padStart(4, '0')}`;
        jobs.push({ att: a, originalUrl: d.imageUrl, localPath });
      }
    }
    if (m.reply_message) walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) walk(f);
  }
  for (const m of messages) walk(m);

  const entries: ZipEntry[] = [];
  const total = jobs.length;
  onProgress(0, total);

  // 2. Качаем картинки порциями по EMBED_CONCURRENCY, кладём в архив,
  //    подменяем URL в attachments на локальный путь с правильным расширением.
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(EMBED_CONCURRENCY, total) }, async () => {
    while (next < total) {
      if (isCancelled()) return;
      const i = next++;
      const job = jobs[i];

      try {
        const res = await fetch(job.originalUrl, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) { onProgress(++done, total); continue; }

        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length > EMBED_MAX_BYTES) { onProgress(++done, total); continue; }

        const ext = extFromMime(res.headers.get('content-type'));
        const fullPath = `${job.localPath}.${ext}`;
        entries.push({ name: fullPath, data: buf });
        injectDataUrl(job.att, job.originalUrl, fullPath);
      } catch {
        // CORS / сеть — пропускаем, в HTML останется относительный путь без файла,
        // но это всё равно лучше, чем сломать весь экспорт.
      }
      onProgress(++done, total);
    }
  });
  await Promise.all(workers);

  // 3. Генерим HTML, добавляем как корневой index.html.
  const html = buildHtml(title, messages, names);
  entries.unshift({ name: 'index.html', data: html });

  return buildZip(entries);
}

// ─── UI: progress overlay ─────────────────────────────────────────────────

function showProgressOverlay(title: string): {
  setPhase: (label: string) => void;
  setProgress: (loaded: number, total: number) => void;
  onCancel: (cb: () => void) => void;
  close: () => void;
} {
  const old = document.getElementById(ROOT_ID);
  old?.remove();

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="vkify-export-card">
      <div class="vkify-export-title" data-vkify-phase>Экспорт диалога</div>
      <div class="vkify-export-sub" data-vkify-sub>«${escapeHtml(title)}»</div>
      <div class="vkify-export-bar"><div class="vkify-export-fill" data-vkify-fill></div></div>
      <div class="vkify-export-actions">
        <button class="vkify-export-cancel" data-vkify-cancel>Отмена</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const fill  = root.querySelector<HTMLElement>('[data-vkify-fill]')!;
  const sub   = root.querySelector<HTMLElement>('[data-vkify-sub]')!;
  const phase = root.querySelector<HTMLElement>('[data-vkify-phase]')!;
  const cancelBtn = root.querySelector<HTMLButtonElement>('[data-vkify-cancel]')!;
  let cancelCb: (() => void) | null = null;

  cancelBtn.addEventListener('click', () => cancelCb?.());

  return {
    setPhase(label) {
      phase.textContent = label;
    },
    setProgress(loaded, total) {
      const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      fill.style.width = pct + '%';
      sub.textContent = total > 0
        ? `«${title}» · ${loaded} из ${total} (${pct}%)`
        : `«${title}» · загружено ${loaded}`;
    },
    onCancel(cb) { cancelCb = cb; },
    close() { root.remove(); },
  };
}

async function runExport(format: ExportFormat, decrypt: boolean): Promise<void> {
  const peerId = detectPeerId();
  if (peerId === null) {
    alert('VKify: не удалось определить ID диалога');
    return;
  }
  const title = detectChatTitle();

  let cancelled = false;
  const overlay = showProgressOverlay(title);
  overlay.onCancel(() => { cancelled = true; });

  try {
    overlay.setPhase('Загрузка сообщений');
    const { messages, names } = await fetchAllHistory(
      peerId,
      (loaded, total) => overlay.setProgress(loaded, total),
      () => cancelled,
    );

    // Опциональная расшифровка с использованием сохранённого ключа.
    if (decrypt) {
      const stored = await chrome.storage.local.get(['message_crypto_key']);
      const key = (stored['message_crypto_key'] as string | undefined) ?? '';
      if (key) {
        overlay.setPhase('Расшифровываю сообщения');
        overlay.setProgress(0, 0);
        await decryptAllInPlace(messages, key);
      }
    }

    if (format === 'html-embed') {
      overlay.setPhase('Встраиваю фото в файл');
      overlay.setProgress(0, 0);
      await embedAllImages(
        messages,
        (done, total) => overlay.setProgress(done, total),
        () => cancelled,
      );
    }

    if (format === 'html-zip') {
      overlay.setPhase('Скачиваю фото для архива');
      overlay.setProgress(0, 0);
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = await buildZipArchive(
        title,
        messages,
        names,
        (done, total) => overlay.setProgress(done, total),
        () => cancelled,
      );
      triggerDownloadBlob(blob, `${sanitizeFilename(title)}_${stamp}.zip`);
      return;
    }

    let content: string;
    let mime: string;
    let ext: string;
    if (format === 'json')                                     { content = buildJson(title, peerId, messages, names); mime = 'application/json'; ext = 'json'; }
    else if (format === 'html' || format === 'html-embed')     { content = buildHtml(title, messages, names);          mime = 'text/html';        ext = 'html'; }
    else                                                       { content = buildTxt(title, messages, names);           mime = 'text/plain';       ext = 'txt';  }

    const stamp = new Date().toISOString().slice(0, 10);
    triggerDownload(content, `${sanitizeFilename(title)}_${stamp}.${ext}`, mime);
  } catch (err) {
    if (!cancelled) {
      console.error('[VKify] Export failed:', err);
      alert('VKify: не удалось экспортировать диалог. Проверьте, что вы авторизованы в ВК и токен расширения активен.');
    }
  } finally {
    overlay.close();
  }
}

// ─── UI: dropdown menu ────────────────────────────────────────────────────

function showFormatMenu(anchor: HTMLElement): void {
  document.getElementById('vkify-export-menu-root')?.remove();

  const menu = document.createElement('div');
  menu.id = 'vkify-export-menu-root';
  menu.className = 'vkify-export-menu';
  menu.innerHTML = `
    <button data-fmt="json"><span class="vkify-fmt">JSON</span><span>Сырые данные для скриптов</span></button>
    <button data-fmt="txt"><span class="vkify-fmt">TXT</span><span>Простой текст</span></button>
    <button data-fmt="html"><span class="vkify-fmt">HTML</span><span>Ссылки на фото (легче)</span></button>
    <button data-fmt="html-embed"><span class="vkify-fmt">HTML+</span><span>Фото внутри файла (base64)</span></button>
    <button data-fmt="html-zip"><span class="vkify-fmt">ZIP</span><span>HTML + папка с фото в архиве</span></button>
    <div class="vkify-export-menu-sep"></div>
    <label class="vkify-export-menu-opt" data-vkify-decrypt>
      <input type="checkbox" data-vkify-decrypt-cb>
      <span>Расшифровать сообщения ключом из настроек</span>
    </label>
  `;
  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  // Изначально позиционируем под кнопкой; если не влезает справа — прижимаем к правому краю.
  menu.style.top  = `${rect.bottom + 6}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)}px`;

  menu.addEventListener('click', (e) => {
    // Клик по чекбоксу/лейблу — не закрываем меню, это часть выбора.
    if ((e.target as HTMLElement).closest('[data-vkify-decrypt]')) return;

    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-fmt]');
    if (!btn) return;
    const fmt = btn.dataset['fmt'] as ExportFormat;
    const decrypt = menu.querySelector<HTMLInputElement>('[data-vkify-decrypt-cb]')?.checked ?? false;
    menu.remove();
    void runExport(fmt, decrypt);
  });

  const outside = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node) && e.target !== anchor) {
      menu.remove();
      document.removeEventListener('mousedown', outside, true);
    }
  };
  document.addEventListener('mousedown', outside, true);
}

// ─── injection into ConvoHeader ───────────────────────────────────────────

function injectIntoHeader(controls: Element): void {
  if (controls.hasAttribute(BTN_ATTR)) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vkify-export-btn';
  btn.title = 'Экспорт диалога (VKify)';
  btn.setAttribute('aria-label', 'Экспорт диалога');
  btn.innerHTML = ICON_DOWNLOAD;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showFormatMenu(btn);
  });

  // Вставляем перед последней кнопкой (троеточие «Ещё»), чтобы оставаться
  // в визуальной группе действий шапки. Кнопка «Ещё» вложена в несколько
  // DropdownReforged-обёрток — поднимаемся по DOM, пока не найдём прямого
  // ребёнка controls (иначе insertBefore выбросит NotFoundError).
  const moreTrigger = controls.querySelector<HTMLElement>('#convo-more-menu-trigger');
  let anchor: Element | null = moreTrigger;
  while (anchor && anchor.parentElement !== controls) {
    anchor = anchor.parentElement;
  }
  if (anchor && anchor.parentElement === controls) controls.insertBefore(btn, anchor);
  else controls.appendChild(btn);

  controls.setAttribute(BTN_ATTR, '1');
}

function scanAll(): void {
  document.querySelectorAll('.ConvoHeader__controls').forEach(injectIntoHeader);
}

export function registerDialogExportFeature(manager: FeatureManager): void {
  let observer: MutationObserver | null = null;
  let styleEl: HTMLStyleElement | null = null;

  manager.register('dialog_export_enabled', {
    enable: () => {
      if (observer) return;

      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = STYLE_CSS;
      document.head.appendChild(styleEl);

      scanAll();

      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches?.('.ConvoHeader__controls')) {
              injectIntoHeader(node);
            } else {
              node.querySelectorAll?.('.ConvoHeader__controls').forEach(injectIntoHeader);
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      console.log('[VKify] Dialog export enabled');
    },

    disable: () => {
      observer?.disconnect();
      observer = null;
      styleEl?.remove();
      styleEl = null;

      document.getElementById('vkify-export-menu-root')?.remove();
      document.getElementById(ROOT_ID)?.remove();

      document.querySelectorAll(`[${BTN_ATTR}]`).forEach((el) => {
        el.removeAttribute(BTN_ATTR);
        el.querySelectorAll('.vkify-export-btn').forEach(b => b.remove());
      });

      console.log('[VKify] Dialog export disabled');
    },
  });
}
