import type { FeatureManager } from '../../../core/feature-manager.js';
import type { PinnedNote } from '../../../../types/index.js';
import { StorageKey } from '../../../../shared/constants/storage-keys.js';

/**
 * «Прикрепить как заметку»: рядом с кнопкой копирования появляется иконка
 * закладки, по клику текст сообщения (плюс автор, время, peer_id чата)
 * сохраняется в локальный архив заметок (chrome.storage.local). Заметки
 * редактируются и просматриваются во вкладке «Заметки» попапа.
 *
 * Никаких сетевых обращений: всё локально, никаких чужих серверов, как и
 * у быстрого копирования.
 */

const BTN_ATTR  = 'data-vkify-pin-injected';
const STYLE_ID  = 'vkify-pin-note-styles';
const BTN_CLASS = 'vkify-pin-btn';

const CHAT_PEER_OFFSET = 2_000_000_000;
const MAX_NOTES = 500;

const STYLE_CSS = `
  .${BTN_CLASS} {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-left: 4px;
    padding: 0;
    border: none;
    background: rgba(127, 127, 127, 0.12);
    border-radius: 5px;
    cursor: pointer;
    color: var(--vkui--color_icon_secondary, #6d7885);
    transition: background 0.12s ease, color 0.12s ease, transform 0.12s ease;
    vertical-align: middle;
    flex-shrink: 0;
  }
  .${BTN_CLASS}:hover {
    background: rgba(255, 152, 0, 0.18);
    color: #ff9800;
  }
  .${BTN_CLASS}:active { transform: scale(0.9); }
  .${BTN_CLASS}--done {
    background: rgba(255, 152, 0, 0.25) !important;
    color: #ff9800 !important;
  }
  .${BTN_CLASS} svg { width: 13px; height: 13px; pointer-events: none; }
`;

// Иконка-закладка из @vkontakte/icons (bookmark_outline_16). Совпадает с
// BookmarkIcon у вкладки «Заметки» в попапе — пользователь сразу видит связь:
// нажал тут → нашёл там.
const ICON_PIN = `
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M6.719 1H9.28c.674 0 1.225 0 1.672.037.463.037.882.118 1.273.317a3.25 3.25 0 0 1 1.42 1.42c.199.391.28.81.317 1.273.037.448.037.998.037 1.672v6.05c0 .556 0 1.026-.033 1.393-.034.364-.109.773-.369 1.106a1.9 1.9 0 0 1-1.45.731c-.422.011-.795-.171-1.108-.361-.315-.192-.692-.47-1.14-.802l-1.395-1.03a7 7 0 0 0-.364-.26 1 1 0 0 0-.08-.045.25.25 0 0 0-.123 0 1 1 0 0 0-.079.045 7 7 0 0 0-.364.26L6.1 13.836c-.448.332-.825.61-1.14.802-.313.19-.686.372-1.109.362a1.9 1.9 0 0 1-1.45-.732c-.26-.333-.334-.742-.368-1.106C2 12.795 2 12.325 2 11.768v-6.05c0-.673 0-1.223.037-1.671.037-.463.118-.882.317-1.272a3.25 3.25 0 0 1 1.42-1.42c.391-.2.81-.28 1.273-.318C5.495 1 6.045 1 6.719 1M7.94 12.5l-.002.001Zm.12 0 .002.001ZM5.169 2.533c-.37.03-.57.085-.714.159a1.75 1.75 0 0 0-.764.764c-.074.144-.13.343-.16.714-.03.38-.031.869-.031 1.581v5.982c0 .603 0 1.003.027 1.293.022.244.057.317.06.325a.4.4 0 0 0 .297.15c.009-.002.088-.018.297-.145.25-.15.572-.388 1.057-.746l1.365-1.01.069-.05c.268-.2.554-.413.887-.5a1.75 1.75 0 0 1 .882 0c.333.087.618.3.887.5l.069.05 1.365 1.01c.485.358.807.595 1.056.746.21.127.29.143.297.145a.4.4 0 0 0 .297-.15c.004-.008.038-.081.06-.325.027-.29.028-.69.028-1.293V5.75c0-.712 0-1.202-.032-1.581-.03-.37-.085-.57-.159-.713a1.75 1.75 0 0 0-.765-.765c-.144-.074-.343-.13-.713-.16-.38-.03-.869-.031-1.581-.031h-2.5c-.712 0-1.202 0-1.581.032"/>
  </svg>
`;
// «Сохранено» — залитая закладка из @vkontakte/icons (bookmark_16).
const ICON_DONE = `
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M10.482 1.071c.546.045 1.026.139 1.47.365a3.75 3.75 0 0 1 1.64 1.634c.226.443.32.922.365 1.467.043.53.043 1.184.043 1.994v5.489c0 .496 0 .919-.03 1.251s-.1.714-.345 1.031a1.8 1.8 0 0 1-1.358.697c-.401.015-.754-.152-1.042-.32s-.634-.414-1.039-.702L8.494 12.77a7 7 0 0 0-.356-.245 1 1 0 0 0-.078-.042.25.25 0 0 0-.12 0 1 1 0 0 0-.078.042c-.08.048-.18.12-.356.245l-1.692 1.206c-.405.288-.75.534-1.04.703-.287.167-.64.334-1.04.32a1.8 1.8 0 0 1-1.359-.698c-.245-.317-.314-.7-.344-1.03C2 12.937 2 12.514 2 12.02V6.53c0-.71 0-1.298.029-1.79l.014-.204c.045-.545.14-1.024.366-1.467a3.75 3.75 0 0 1 1.639-1.634c.444-.226.924-.32 1.47-.365q.347-.027.767-.035c1.388-.03 2.811-.078 4.197.035"/>
  </svg>
`;

// ─── извлечение метаданных сообщения ──────────────────────────────────────

function extractMessageText(messageBlock: Element): string {
  const textEl =
    messageBlock.querySelector<HTMLElement>('.ConvoMessageWithoutBubble__text') ||
    messageBlock.querySelector<HTMLElement>('.ConvoMessageBubble__text') ||
    messageBlock.querySelector<HTMLElement>('[class*="MessageBubble__text"]') ||
    messageBlock.querySelector<HTMLElement>('[class*="Message__text"]');
  if (!textEl) return '';

  // Отбрасываем decorations расшифровки (☕ COFFEE: / 🔐 E2E:)
  const clone = textEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[title*="нажмите, чтобы увидеть оригинал"]').forEach(el => el.remove());
  return clone.innerText.trim();
}

function extractAuthor(messageBlock: Element): string {
  return messageBlock.querySelector<HTMLElement>(
    '.ConvoMessageHeader__authorLink .PeerTitle__title, [class*="MessageHeader"] [class*="PeerTitle__title"], [class*="MessageHeader"] [class*="__author"]',
  )?.textContent?.trim() ?? '';
}

function extractTime(messageBlock: Element): string {
  return messageBlock.querySelector<HTMLElement>(
    '.ConvoMessageInfoWithoutBubbles__date, [class*="__date"]',
  )?.textContent?.trim() ?? '';
}

/** peer_id текущего открытого чата (нужен, чтобы в попапе показать «откуда»). */
function detectPeerId(): number | null {
  const sp = new URLSearchParams(location.search);
  const sel = sp.get('sel') ?? sp.get('peer');
  if (sel) {
    if (/^c\d+$/.test(sel)) return CHAT_PEER_OFFSET + Number(sel.slice(1));
    const n = Number(sel);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  const m = location.pathname.match(/\/im(?:\/convo)?\/(-?\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  return null;
}

function detectPeerTitle(): string {
  const el =
    document.querySelector<HTMLElement>('.ConvoHeader .ConvoTitle__author') ||
    document.querySelector<HTMLElement>('.ConvoHeader .PeerTitle__title');
  return el?.getAttribute('title')?.trim() || el?.textContent?.trim() || '';
}

// ─── сохранение ───────────────────────────────────────────────────────────

async function appendNote(note: PinnedNote): Promise<void> {
  const cur = await chrome.storage.local.get([StorageKey.VKIFY_NOTES]);
  const list: PinnedNote[] = (cur[StorageKey.VKIFY_NOTES] as PinnedNote[] | undefined) ?? [];

  // Не дублируем то же сообщение, если пользователь дважды нажал.
  // Кейс: пользователь шифранул и расшифровал — текст одинаковый, время одинаковое.
  const dup = list.find(n =>
    n.text === note.text && n.peerId === note.peerId && n.origTime === note.origTime,
  );
  if (dup) return;

  list.push(note);
  if (list.length > MAX_NOTES) list.splice(0, list.length - MAX_NOTES);
  await chrome.storage.local.set({ [StorageKey.VKIFY_NOTES]: list });
}

function makeId(): string {
  return `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeButton(messageBlock: Element): HTMLButtonElement {
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

function injectInto(messageBlock: Element): void {
  if (messageBlock.hasAttribute(BTN_ATTR)) return;

  // Текст обязателен.
  const hasText =
    messageBlock.querySelector('.ConvoMessageWithoutBubble__text') ||
    messageBlock.querySelector('.ConvoMessageBubble__text') ||
    messageBlock.querySelector('[class*="MessageBubble__text"]') ||
    messageBlock.querySelector('[class*="Message__text"]');
  if (!hasText) return;

  const infoRow =
    messageBlock.querySelector<HTMLElement>('.ConvoMessageInfoWithoutBubbles') ??
    messageBlock.querySelector<HTMLElement>('[class*="ConvoMessageBubble__info"]') ??
    messageBlock.querySelector<HTMLElement>('[class*="MessageInfo"]') ??
    messageBlock.querySelector<HTMLElement>('[class*="Message__info"]');

  const btn = makeButton(messageBlock);
  if (infoRow) infoRow.appendChild(btn);
  else {
    const content =
      messageBlock.querySelector('.ConvoMessageWithoutBubble__content') ||
      messageBlock.querySelector('[class*="MessageBubble__content"]');
    content?.appendChild(btn);
  }

  messageBlock.setAttribute(BTN_ATTR, '1');
}

function scanAll(root: ParentNode = document): void {
  root.querySelectorAll('.ConvoHistory__messageBlock').forEach(injectInto);
}

export function registerPinNoteFeature(manager: FeatureManager): void {
  let observer: MutationObserver | null = null;
  let styleEl: HTMLStyleElement | null = null;

  manager.register('message_pin_notes', {
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
            if (node.matches?.('.ConvoHistory__messageBlock')) {
              injectInto(node);
            } else {
              scanAll(node);
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      console.log('[VKify] Pin notes enabled');
    },

    disable: () => {
      observer?.disconnect();
      observer = null;
      styleEl?.remove();
      styleEl = null;

      document.querySelectorAll(`[${BTN_ATTR}]`).forEach((el) => {
        el.removeAttribute(BTN_ATTR);
        el.querySelectorAll(`.${BTN_CLASS}`).forEach(b => b.remove());
      });

      console.log('[VKify] Pin notes disabled');
    },
  });
}
