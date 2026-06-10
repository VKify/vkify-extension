import type { FeatureManager } from '../../../core/feature-manager.js';

/**
 * Быстрое копирование сообщения: рядом со временем отправки в каждом
 * сообщении ВК отображается всегда видимая кнопка «копировать». Не зависит
 * от hover и от того, в каком виде (bubble / no-bubble) сейчас отображается
 * мессенджер.
 *
 * Особенности:
 *   • Если включена расшифровка VKify/COFFEE — копируется уже расшифрованный
 *     текст (без префикса «☕ COFFEE:» / «🔐 E2E:»), потому что эти префиксы
 *     помечены `title="…нажмите, чтобы увидеть оригинал"` и однозначно
 *     детектируются по этому атрибуту.
 *   • Кнопка появляется только у сообщений с текстом — пустые системные
 *     сообщения (вход в беседу и т.п.) её не получают.
 *   • Кнопка инжектится один раз; повторный скан или подгрузка истории не
 *     дублирует её (data-vkify-copy-injected).
 *   • Shift+клик по кнопке копирует диапазон сообщений: первый Shift+клик
 *     отмечает «якорь», второй — копирует все сообщения между ними
 *     (в порядке документа) одной простынёй «[время] автор: текст».
 */

const BTN_ATTR  = 'data-vkify-copy-injected';
const STYLE_ID  = 'vkify-quick-copy-styles';
const BTN_CLASS = 'vkify-copy-btn';

const STYLE_CSS = `
  .${BTN_CLASS} {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-left: 6px;
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
    background: rgba(0, 119, 255, 0.16);
    color: #0077ff;
  }
  .${BTN_CLASS}:active { transform: scale(0.9); }
  .${BTN_CLASS}--done {
    background: rgba(76, 175, 80, 0.2) !important;
    color: #4caf50 !important;
  }
  .${BTN_CLASS}--anchor {
    background: rgba(255, 152, 0, 0.25) !important;
    color: #ff9800 !important;
    box-shadow: 0 0 0 1px rgba(255, 152, 0, 0.5);
  }
  .vkify-copy-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.85); color: #fff;
    padding: 8px 14px; border-radius: 8px;
    font: 13px/1.3 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483646;
    pointer-events: none;
    animation: vkify-copy-toast-in 0.18s ease-out, vkify-copy-toast-out 0.25s ease-in 1.5s forwards;
  }
  @keyframes vkify-copy-toast-in  { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
  @keyframes vkify-copy-toast-out { to { opacity: 0; transform: translate(-50%, 8px); } }
  .${BTN_CLASS} svg {
    width: 13px; height: 13px; pointer-events: none;
  }
`;

// Глифы из @vkontakte/icons (copy_24 / done_24)
const ICON_COPY = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 18a2.01 2.01 0 0 1-2-2.01V5.518A3.517 3.517 0 0 1 5.518 2H15.99A2.01 2.01 0 0 1 18 4H6.764A2.764 2.764 0 0 0 4 6.764zM8.01 6h11.98C21.1 6 22 6.9 22 8.01v11.98c0 1.11-.9 2.01-2.01 2.01H8.01C6.9 22 6 21.1 6 19.99V8.01C6 6.9 6.9 6 8.01 6M9 8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1z"/>
  </svg>
`;
const ICON_DONE = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m9 16.2-3.5-3.5a.99.99 0 1 0-1.4 1.4l4.193 4.193a1 1 0 0 0 1.414 0L20.3 7.7a.99.99 0 0 0-1.4-1.4z"/>
  </svg>
`;

/**
 * Извлекает чистый текст сообщения, отбрасывая префиксные метки расшифровки
 * (☕ COFFEE: / 🔐 E2E:), которые добавляет фича message-crypto.
 */
function extractMessageText(messageBlock: Element): string {
  const textEl = findTextEl(messageBlock);
  if (!textEl) return '';

  const clone = textEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[title*="нажмите, чтобы увидеть оригинал"]')
    .forEach(el => el.remove());

  return clone.innerText.trim();
}

function findTextEl(messageBlock: Element): HTMLElement | null {
  return messageBlock.querySelector<HTMLElement>('.ConvoMessageWithoutBubble__text')
      ?? messageBlock.querySelector<HTMLElement>('.ConvoMessageBubble__text')
      ?? messageBlock.querySelector<HTMLElement>('[class*="MessageBubble__text"]')
      ?? messageBlock.querySelector<HTMLElement>('[class*="Message__text"]');
}

/** Узел, рядом с которым размещаем кнопку — строка с датой/статусом. */
function findInfoRow(messageBlock: Element): HTMLElement | null {
  return messageBlock.querySelector<HTMLElement>('.ConvoMessageInfoWithoutBubbles')
      ?? messageBlock.querySelector<HTMLElement>('[class*="ConvoMessageBubble__info"]')
      ?? messageBlock.querySelector<HTMLElement>('[class*="MessageInfo"]')
      ?? messageBlock.querySelector<HTMLElement>('[class*="Message__info"]');
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Имя автора из шапки сообщения (если есть — для bulk-копирования). */
function extractAuthor(messageBlock: Element): string {
  const el =
    messageBlock.querySelector<HTMLElement>('.ConvoMessageHeader__authorLink .PeerTitle__title') ||
    messageBlock.querySelector<HTMLElement>('[class*="MessageHeader"] [class*="PeerTitle__title"]') ||
    messageBlock.querySelector<HTMLElement>('[class*="MessageHeader"] [class*="__author"]');
  return el?.textContent?.trim() ?? '';
}

/** Время отправки из инфо-строки сообщения. */
function extractTime(messageBlock: Element): string {
  const el =
    messageBlock.querySelector<HTMLElement>('.ConvoMessageInfoWithoutBubbles__date') ||
    messageBlock.querySelector<HTMLElement>('[class*="__date"]');
  return el?.textContent?.trim() ?? '';
}

function formatLineFor(messageBlock: Element, fallbackAuthor: string): string {
  const text = extractMessageText(messageBlock);
  if (!text) return '';
  const time   = extractTime(messageBlock);
  const author = extractAuthor(messageBlock) || fallbackAuthor;
  const head   = [time, author].filter(Boolean).join(' ');
  return head ? `[${head}] ${text}` : text;
}

/** Все .ConvoHistory__messageBlock в порядке документа между двумя (включительно). */
function collectRange(a: Element, b: Element): Element[] {
  const all = Array.from(document.querySelectorAll<Element>('.ConvoHistory__messageBlock'));
  let i = all.indexOf(a);
  let j = all.indexOf(b);
  if (i < 0 || j < 0) return [];
  if (i > j) [i, j] = [j, i];
  return all.slice(i, j + 1);
}

function showToast(text: string): void {
  const t = document.createElement('div');
  t.className = 'vkify-copy-toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

/** Состояние shift-клика. Якорь — первое сообщение, второй клик закрывает диапазон. */
let bulkAnchor: { block: Element; btn: HTMLButtonElement } | null = null;

function clearAnchor(): void {
  if (!bulkAnchor) return;
  bulkAnchor.btn.classList.remove(`${BTN_CLASS}--anchor`);
  bulkAnchor.btn.title = 'Копировать текст сообщения';
  bulkAnchor = null;
}

function makeButton(messageBlock: Element): HTMLButtonElement {
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
      if (!bulkAnchor) {
        bulkAnchor = { block: messageBlock, btn };
        btn.classList.add(`${BTN_CLASS}--anchor`);
        btn.title = 'Якорь выбран. Shift+клик на другом сообщении — скопировать диапазон. Esc — отменить.';
        return;
      }

      if (bulkAnchor.block === messageBlock) {
        // Повторный Shift+клик на том же — отменяем выбор.
        clearAnchor();
        return;
      }

      const range = collectRange(bulkAnchor.block, messageBlock);
      const lines = range
        .map(b => formatLineFor(b, ''))
        .filter(Boolean);
      const ok = await copyToClipboard(lines.join('\n'));
      clearAnchor();
      showToast(ok ? `Скопировано ${lines.length} сообщений` : 'Не удалось скопировать');
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

function injectInto(messageBlock: Element): void {
  if (messageBlock.hasAttribute(BTN_ATTR)) return;
  if (!findTextEl(messageBlock)) return; // нет текста — системка, пропускаем

  const infoRow = findInfoRow(messageBlock);
  const btn = makeButton(messageBlock);

  if (infoRow) {
    infoRow.appendChild(btn);
  } else {
    // Фолбэк: вставляем сразу после контейнера контента, чтобы кнопка всё
    // равно появилась, даже если разметка инфо-строки изменилась.
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

export function registerQuickCopyFeature(manager: FeatureManager): void {
  let observer: MutationObserver | null = null;
  let styleEl: HTMLStyleElement | null = null;
  let escHandler: ((e: KeyboardEvent) => void) | null = null;

  manager.register('message_quick_copy', {
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

      escHandler = (e) => { if (e.key === 'Escape' && bulkAnchor) clearAnchor(); };
      window.addEventListener('keydown', escHandler);

      console.log('[VKify] Quick copy enabled');
    },

    disable: () => {
      observer?.disconnect();
      observer = null;
      styleEl?.remove();
      styleEl = null;

      if (escHandler) window.removeEventListener('keydown', escHandler);
      escHandler = null;
      clearAnchor();

      document.querySelectorAll(`[${BTN_ATTR}]`).forEach((el) => {
        el.removeAttribute(BTN_ATTR);
        el.querySelectorAll(`.${BTN_CLASS}`).forEach(b => b.remove());
      });

      console.log('[VKify] Quick copy disabled');
    },
  });
}
