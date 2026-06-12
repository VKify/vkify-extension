/**
 * Фича шифрования сообщений ВКонтакте.
 *
 * Криптография вынесена в ./message-crypto-core.ts (тестируется отдельно).
 *
 * Поведение:
 *   • Авторасшифровка входящих сообщений через MutationObserver.
 *     COFFEE и VKify определяются по маркерам автоматически.
 *   • Кнопка ☕/🔐 в тулбаре composer'а — шифрует набираемый текст.
 *
 * Поддерживаемые форматы:
 *   • VKify E2E v2 — AES-256-GCM (маркер 🔐…🔐)
 *   • COFFEE      — AES-128-ECB, Kate Mobile / VK Coffee / Laney / Vika
 *                   (маркеры PP, II, VK COFFEE, AP IDOG)
 */

import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '../../../types/index.js';
import {
  coffeeEncrypt,
  coffeeTryDecrypt,
  vkifyEncrypt,
  vkifyTryDecrypt,
  VKIFY_MARKER,
  type CoffeeMarker,
} from './message-crypto-core.js';

// ── Константы ────────────────────────────────────────────────────────────────

const PROCESSED_ATTR = 'data-vkify-e2e';
const BTN_CLASS      = 'vkify-crypto-btn';
const STYLE_ID       = 'vkify-crypto-style';
const POLL_INTERVAL  = 2000;

/**
 * Селекторы текстовых контейнеров в разных версиях UI ВК.
 *
 * Важно: `[class*=]` — substring-матч, поэтому `ConvoMessage__text` НЕ ловит
 * `ConvoMessageWithoutBubble__text` (UI без пузырей) — нужен отдельный селектор.
 *
 * Расшифровываются:
 *   • IM Messenger        (диалоги: пузыри + compact + старый IM)
 *   • Стена / новости     (текст поста, развёрнутый "ещё")
 *   • Комментарии к стене (VKUI)
 *   • Комментарии к топику (классический бордовый интерфейс /topic-)
 */
const MSG_SELECTORS = [
  // ── IM Messenger (VKUI) ────────────────────────────────────────────────
  // Современный VKUI с пузырями
  '[class*="ConvoMessage__text"]',
  '[class*="ConvoMessage__body"]',
  // VKUI без пузырей (compact mode) — отдельный класс, не пересекается
  '[class*="ConvoMessageWithoutBubble__text"]',
  // Общий внутренний контейнер текста — присутствует в обоих режимах IM
  '.MessageText',
  // VKUI старых версий
  '[class*="MessageContent__text"]',
  '[class*="MessageContent__body"]',
  '[data-testid="message-content-text"]',
  '[data-testid="message-text"]',
  // Классический IM (im.php)
  '.im_msg_text',
  '.message_text',

  // ── Стена / новости (VKUI) ─────────────────────────────────────────────
  // Корневой span текста поста
  '[class*="FeedPostText__root"]',
  // Внутренний div с самим текстом (после раскрытия «показать ещё»)
  '[class*="FeedShowMoreText__text"]',
  // Стабильный data-testid для тела поста
  '[data-testid="showmoretext"]',
  // Классическая стена (wall.php) — реликт
  '.wall_post_text',
  '.pi_text',

  // ── Комментарии к стене (VKUI) ─────────────────────────────────────────
  // Контейнер комментария — TreeWalker найдёт текст внутри
  '[class*="CommentText"]',
  '[class*="ReplyComment__text"]',
  '[data-testid="wall_comment_text"]',
  // Классические wall-комментарии (старый интерфейс)
  '.wall_reply_text',
  '.reply_text',

  // ── Топики (Board, классический интерфейс /topic-) ─────────────────────
  '.bp_text',
].join(',');

type Format = 'COFFEE' | 'VKify';

// ── DOM-утилиты ──────────────────────────────────────────────────────────────

/** Вставляет текст с переносами строк как text-узлы + <br> — без innerHTML. */
function setMultilineText(el: Element, text: string): void {
  el.textContent = '';
  text.split('\n').forEach((line, i) => {
    if (i > 0) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });
}

/**
 * Полный «логический» текст элемента с учётом подмены emoji.
 *
 * Зачем: VK заменяет emoji-символы (включая 🔐 — маркер VKify) на
 * `<img class="Emoji @<hex>" alt="🔐">`. Обычный `node.textContent` теряет
 * маркер — VKify-сообщение не распознаётся. Восстанавливаем символ из `alt`.
 *
 * VK использует РАЗНЫЕ имена классов в разных контекстах:
 *   • VKUI Messenger:   `Emoji` (с заглавной E) + `@<hex-кодпойнт>`
 *   • Классический VK:  `emoji` (строчные)
 *   • Иногда:           `data-emoji` атрибут
 * Поэтому проверяем все варианты + любой <img alt="..."> вообще,
 * если у него короткий alt (1–4 кодпойнта) и нет осмысленного src
 * (это эвристика — нормальные картинки имеют длинный alt и реальный src).
 */
function getRichText(root: Element): string {
  let text = '';
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        const el = node as Element;
        if (el.tagName === 'IMG') {
          const cl = el.classList;
          if (cl.contains('Emoji') || cl.contains('emoji') || el.hasAttribute('data-emoji')) {
            return NodeFilter.FILTER_ACCEPT;
          }
          // Фолбэк: короткий alt — почти всегда emoji-подмена.
          const alt = (el as HTMLImageElement).alt;
          if (alt && alt.length <= 4 && /[^\x00-\x7F]/.test(alt)) {
            return NodeFilter.FILTER_ACCEPT;
          }
        }
        if (el.tagName === 'BR') return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    },
  );
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      text += n.textContent ?? '';
    } else {
      const el = n as Element;
      if (el.tagName === 'IMG') {
        text += (el as HTMLImageElement).alt || '';
      } else if (el.tagName === 'BR') {
        text += '\n';
      }
    }
  }
  return text;
}

// ── Авторасшифровка ──────────────────────────────────────────────────────────

/**
 * Заменяет содержимое элемента на badge + расшифровку.
 *
 * Полностью очищает innerHTML — это безопасно, так как обнаружение возможно
 * только когда ВЕСЬ текст элемента есть валидный cipher (markers по краям).
 * Сохраняем сам элемент и его атрибуты — внешние стили/data-* не теряются.
 */
function replaceElementContent(el: Element, format: Format, decrypted: string, original: string): void {
  const isCoffee = format === 'COFFEE';
  const color    = isCoffee ? '#f59e0b' : '#4caf50';
  const label    = isCoffee ? '☕ COFFEE' : '🔐 VKify E2E';
  const prefix   = isCoffee ? '☕ COFFEE:' : '🔐 E2E:';

  const badge = document.createElement('span');
  badge.style.cssText = [
    'display:inline-flex', 'align-items:center', 'gap:3px',
    'margin-right:6px',    'font-size:11px',     'font-weight:700',
    'cursor:pointer',      'user-select:none',   'vertical-align:middle',
    `color:${color}`,
  ].join(';');
  badge.title       = `${label} · нажмите, чтобы увидеть оригинал`;
  badge.textContent = prefix;

  const content = document.createElement('span');
  setMultilineText(content, decrypted);

  let showingOriginal = false;
  badge.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    showingOriginal = !showingOriginal;
    if (showingOriginal) {
      content.textContent = original;
      badge.style.color   = '#9e9e9e';
      badge.title         = `${label} · нажмите, чтобы показать расшифровку`;
    } else {
      setMultilineText(content, decrypted);
      badge.style.color   = color;
      badge.title         = `${label} · нажмите, чтобы увидеть оригинал`;
    }
  });

  el.innerHTML = '';
  el.appendChild(badge);
  el.appendChild(content);
}

async function scanElement(el: Element, key: string): Promise<void> {
  if (el.getAttribute(PROCESSED_ATTR)) return;
  // Предок обработан (например, ConvoMessageWithoutBubble__text) — внутренний
  // .MessageText не нужно скакать заново.
  if (el.parentElement?.closest(`[${PROCESSED_ATTR}]`)) return;

  // Важно: textContent ТЕРЯЕТ emoji-символы (VK подменяет их на <img class="emoji" alt="🔐">),
  // поэтому VKify-маркер исчезал. getRichText восстанавливает текст из alt.
  const raw = getRichText(el).trim();
  if (!raw) return;

  // VKify первым — если есть ключ и маркер. Маркер мог быть восстановлен из <img alt="🔐">.
  if (key && raw.includes(VKIFY_MARKER)) {
    const vkify = await vkifyTryDecrypt(raw, key);
    if (vkify !== null) {
      el.setAttribute(PROCESSED_ATTR, '1');
      replaceElementContent(el, 'VKify', vkify, raw);
      return;
    }
  }

  // COFFEE — пробуем сначала с пользовательским ключом, потом с дефолтным.
  // Это нужно, потому что одни сообщения могут быть зашифрованы Kate Mobile
  // (дефолтный публичный ключ), а другие — пользовательским ключом.
  let coffee: string | null = null;
  if (key) coffee = coffeeTryDecrypt(raw, key);
  if (coffee === null) coffee = coffeeTryDecrypt(raw);  // дефолтный ключ
  if (coffee !== null) {
    el.setAttribute(PROCESSED_ATTR, '1');
    replaceElementContent(el, 'COFFEE', coffee, raw);
    return;
  }

  // Не сматчилось — помечаем, чтобы не сканить заново при каждом mutation.
  // Если сообщение придёт частями (редко), polling-обзор подберёт его на следующем тике.
  el.setAttribute(PROCESSED_ATTR, '1');
}

function scanAll(key: string): void {
  document.querySelectorAll(MSG_SELECTORS).forEach(el => {
    if (!el.getAttribute(PROCESSED_ATTR)) void scanElement(el, key);
  });
}

// ── Кнопка шифрования ────────────────────────────────────────────────────────

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${BTN_CLASS} {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border-radius: 50%; border: none;
      background: transparent; cursor: pointer; font-size: 16px;
      line-height: 1; transition: background .15s; flex-shrink: 0;
      outline: none; padding: 0; margin: 0; vertical-align: middle;
      color: inherit;
    }
    .${BTN_CLASS}--lg        { width: 44px; height: 44px; font-size: 18px; }
    .${BTN_CLASS}:hover      { background: rgba(76,175,80,.15); }
    .${BTN_CLASS}.vkify-busy { opacity: .5; pointer-events: none; }

    /* Топик-ответ: emoji_smile_wrap абсолютно позиционирован справа от
       reply_field. Включаем inline-flex, чтобы наша кнопка встала слева от emoji. */
    .emoji_smile_wrap:has(> .${BTN_CLASS}),
    [class*="PostInputWithEmoji__emojiWrapper"]:has(> .${BTN_CLASS}) {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Описание места для вставки кнопки шифрования.
 *
 * Кнопка кладётся в `toolbar` (либо перед `anchor`, если задан); при клике
 * читается/перезаписывается `input`. `size: 'lg'` — большая 44×44 (только IM),
 * по умолчанию 28×28 (вписывается в кнопки 20–24px VKUI).
 */
interface ComposerSlot {
  input:   HTMLElement;
  toolbar: Element;
  anchor:  Element | null;
  size:    'sm' | 'lg';
}

/** Все активные composer'ы на странице (IM, топик-ответ, VKUI-коммент, VKUI-пост). */
function findComposers(): ComposerSlot[] {
  const out: ComposerSlot[] = [];

  // ── 1. IM Messenger (VKUI) ────────────────────────────────────────────
  for (const toolbar of document.querySelectorAll('.ConvoComposer__inputPanel')) {
    const input =
      document.querySelector<HTMLElement>('.ComposerInput__input[contenteditable="true"]') ??
      document.querySelector<HTMLElement>('[contenteditable="true"][data-placeholder]');
    if (!input) continue;
    const anchor =
      toolbar.querySelector('.StickerEmojiMenuPopper') ??
      toolbar.querySelector('button[class*="sendButton"]')?.closest('div') ??
      null;
    out.push({ input, toolbar, anchor, size: 'lg' });
  }

  // ── 2. Классический IM (im.php, реликт) ───────────────────────────────
  for (const toolbar of document.querySelectorAll('._im_controls, .im-chat-input--buttons, ._im_chat_input_parent')) {
    const input =
      document.querySelector<HTMLElement>('._im_text') ??
      document.querySelector<HTMLElement>('.im-chat-input--text-box');
    if (!input) continue;
    out.push({ input, toolbar, anchor: null, size: 'lg' });
  }

  // ── 3. Ответ в топике (Board, классический интерфейс) ─────────────────
  // emoji_smile_wrap абсолютно позиционирован поверх input'а справа. Чтобы
  // наша кнопка встала ПРЯМО рядом с emoji, инжектим ВНУТРЬ этого же wrap'а
  // (CSS-правило :has() переводит wrap в inline-flex — см. injectStyle).
  for (const wrap of document.querySelectorAll('.reply_field_wrap')) {
    const input     = wrap.querySelector<HTMLElement>('.reply_field[contenteditable="true"]');
    const emojiWrap = wrap.querySelector<HTMLElement>('.emoji_smile_wrap');
    if (!input || !emojiWrap) continue;
    const emojiBtn = emojiWrap.querySelector('.emoji_smile') ?? emojiWrap.firstElementChild;
    out.push({ input, toolbar: emojiWrap, anchor: emojiBtn, size: 'sm' });
  }

  // ── 4. VKUI-комментарий к стене ───────────────────────────────────────
  // afterButtons — это flex-ряд [attach, photo, emoji]. Просто ставим перед emoji.
  for (const container of document.querySelectorAll('[class*="vkitCommentInput__container"]')) {
    const input   = container.querySelector<HTMLElement>('[data-testid="content-editable-input"]');
    const toolbar = container.querySelector('[class*="vkitCommentInputContentEditable__afterButtons"]');
    if (!input || !toolbar) continue;
    const anchor =
      toolbar.querySelector('._emoji_wrap') ??
      toolbar.querySelector('[data-testid="emoji-smile"]')?.closest('button, div') ??
      toolbar.lastElementChild;
    out.push({ input, toolbar, anchor, size: 'sm' });
  }

  // ── 5. VKUI-пост (создание поста на стене) ────────────────────────────
  // Структура: .PostInputWithEmoji__messageInputWrapper (flex) >
  //              [input, placeholder, .emojiWrapper (absolute)]
  // emojiWrapper тоже абсолютно позиционирован — инжектим ВНУТРЬ него.
  for (const wrapper of document.querySelectorAll('[class*="PostInputWithEmoji__messageInputWrapper"]')) {
    const input = wrapper.querySelector<HTMLElement>('[data-testid="posting_base_screen_input_message"]') ??
                  wrapper.querySelector<HTMLElement>('[contenteditable="true"]');
    const emojiWrap = wrapper.querySelector<HTMLElement>('[class*="PostInputWithEmoji__emojiWrapper"]');
    if (!input || !emojiWrap) continue;
    const emojiBtn = emojiWrap.querySelector('._emoji_btn, .emoji_smile') ?? emojiWrap.firstElementChild;
    out.push({ input, toolbar: emojiWrap, anchor: emojiBtn, size: 'sm' });
  }

  return out;
}

function readInputText(input: HTMLElement): string {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    return input.value;
  }
  return input.innerText ?? '';
}

function writeInputText(input: HTMLElement, text: string): void {
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    // React контролирует value через свой setter — обходим через native setter.
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setSelectionRange(text.length, text.length);
    return;
  }
  // Contenteditable: вставляем через execCommand чтобы React/Vue заметили изменение.
  input.focus();
  const range = document.createRange();
  range.selectNodeContents(input);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  document.execCommand('insertText', false, text);
}

/**
 * Скан всех composer'ов и инжект кнопки в те, где её ещё нет.
 *
 * Каждая кнопка через замыкание помнит СВОЙ input — клик в одном composer'е
 * не затрагивает остальные. Если тулбар React'ом перерисовался, кнопка
 * исчезает вместе с ним и пере-инжектится на следующем тике polling'а.
 */
function ensureCryptoButtons(
  format: Format,
  key: string,
  onEncrypt: (text: string) => Promise<string>,
): void {
  const slots = findComposers();
  if (slots.length === 0) return;
  injectStyle();

  const isCoffee = format === 'COFFEE';
  const emoji = isCoffee ? '☕' : '🔐';
  const title = isCoffee
    ? `Зашифровать (☕ COFFEE · AES-128-ECB${key ? ' · пользовательский ключ' : ' · Kate Mobile совместимо'})`
    : `Зашифровать (🔐 VKify E2E · AES-256-GCM)`;

  for (const slot of slots) {
    if (slot.toolbar.querySelector(`.${BTN_CLASS}`)) continue;

    const btn = document.createElement('button');
    btn.className   = slot.size === 'lg' ? `${BTN_CLASS} ${BTN_CLASS}--lg` : BTN_CLASS;
    btn.type        = 'button';
    btn.textContent = emoji;
    btn.title       = title;

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      // Если react-рендер заменил input — closure-ссылка стала detached.
      // Кнопка тоже скоро удалится polling'ом, юзер кликнет ещё раз.
      if (!slot.input.isConnected) return;
      const raw = readInputText(slot.input);
      if (!raw.trim()) return;

      btn.classList.add('vkify-busy');
      void onEncrypt(raw)
        .then(encrypted => writeInputText(slot.input, encrypted))
        .finally(() => btn.classList.remove('vkify-busy'));
    });

    if (slot.anchor && slot.anchor.parentElement === slot.toolbar) {
      slot.toolbar.insertBefore(btn, slot.anchor);
    } else {
      slot.toolbar.appendChild(btn);
    }
  }
}

function removeCryptoButtons(): void {
  document.querySelectorAll(`.${BTN_CLASS}`).forEach(el => el.remove());
  document.getElementById(STYLE_ID)?.remove();
}

// ── FeatureMap export ────────────────────────────────────────────────────────

export function createMessageCryptoFeature(_manager: FeatureManager): FeatureMap {
  let observer:        MutationObserver | null = null;
  let pollInterval:    ReturnType<typeof setInterval> | null = null;
  let storageListener: ((c: Record<string, chrome.storage.StorageChange>, area: string) => void) | null = null;

  function start(format: Format, key: string, coffeeMarker: CoffeeMarker): void {
    scanAll(key);

    observer = new MutationObserver(mutations => {
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.(MSG_SELECTORS)) void scanElement(node, key);
          node.querySelectorAll(MSG_SELECTORS).forEach(el => void scanElement(el, key));
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const encrypt = (text: string): Promise<string> => {
      if (format === 'COFFEE') return Promise.resolve(coffeeEncrypt(text, key || undefined, coffeeMarker));
      return key ? vkifyEncrypt(text, key) : Promise.resolve(text);
    };

    ensureCryptoButtons(format, key, encrypt);
    pollInterval = setInterval(() => ensureCryptoButtons(format, key, encrypt), POLL_INTERVAL);
  }

  function stop(): void {
    observer?.disconnect();
    observer = null;

    if (pollInterval !== null) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (storageListener) {
      chrome.storage.onChanged.removeListener(storageListener);
      storageListener = null;
    }
    // Сбросить флаги обработки: при смене пароля (например, key='' → key='1234')
    // сообщения, ранее помеченные «обработано без расшифровки», должны быть
    // пересканированы. Иначе новый пароль не подхватится для уже видимых сообщений.
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => {
      el.removeAttribute(PROCESSED_ATTR);
    });
    removeCryptoButtons();
  }

  async function init(): Promise<void> {
    const host = window.location.hostname;
    if (host !== 'vk.com' && host !== 'vk.ru') return;

    // Storage listener регистрируется ПЕРВЫМ — до любых early-return.
    // Иначе если фича стартует с format=VKify и пустым ключом, мы выходим без
    // подписки на изменения, и последующий ввод пароля никогда не подхватится.
    storageListener = (changes, area) => {
      if (area !== 'local') return;
      if (
        'message_crypto_format' in changes ||
        'message_crypto_key' in changes ||
        'message_crypto_coffee_marker' in changes
      ) {
        stop();
        void init();
      }
    };
    chrome.storage.onChanged.addListener(storageListener);

    const stored = await chrome.storage.local.get([
      'message_crypto_format',
      'message_crypto_key',
      'message_crypto_coffee_marker',
    ]);
    const format       = ((stored['message_crypto_format'] as string | undefined) ?? 'VKify') as Format;
    const key          =  (stored['message_crypto_key']    as string | undefined) ?? '';
    const coffeeMarker = ((stored['message_crypto_coffee_marker'] as string | undefined) ?? 'PP') as CoffeeMarker;

    // VKify без пароля — расшифровка/шифрование невозможны. Слушатель уже стоит,
    // и как только пользователь введёт пароль — мы перезапустимся.
    if (format === 'VKify' && !key) return;

    start(format, key, coffeeMarker);
  }

  return {
    message_crypto: {
      reapplyOnNavigate: true,
      enable: async (value: unknown) => {
        stop();
        if (value !== true) return;
        await init();
      },
      disable: () => { stop(); },
    },
  };
}