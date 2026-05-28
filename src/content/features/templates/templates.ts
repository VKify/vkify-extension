import type { FeatureManager } from '../../core/feature-manager.js';
import { vkApi } from '../../api/vk-api-client.js';
import { StorageKey } from '../../../shared/constants/storage-keys.js';
import type { MessageTemplate, HotkeyCombo } from '../../../types/index.js';

const DEFAULT_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'Space', label: 'Ctrl+Space',
};

/**
 * Шаблоны сообщений: оверлей-пикер над инпутом ВК-чата с переменными
 * (%first_name%, %last_name%, %my_first_name%, %my_last_name%, %title%,
 * %peer_id%, %time%, %date%, %br%) и тремя триггерами (слэш в начале строки,
 * Ctrl+Space, опциональная автоподсказка по префиксу).
 */
export function registerMessageTemplatesFeatures(manager: FeatureManager): void {
  interface State {
    enabled: boolean;
    triggerSlash: boolean;
    triggerHotkey: boolean;
    hotkey: HotkeyCombo;
    triggerAutocomplete: boolean;
    autoSend: boolean;
    templates: MessageTemplate[];
    myUserId: number | null;
    overlay: HTMLElement | null;
    list: HTMLElement | null;
    keydownHandler: ((e: KeyboardEvent) => void) | null;
    outsideClickHandler: ((e: MouseEvent) => void) | null;
    storageUnsub: (() => void) | null;
    selectedIdx: number;
    filtered: MessageTemplate[];
    pickerOpen: boolean;
    targetEl: HTMLElement | null;
  }

  const state: State = {
    enabled: false,
    triggerSlash: true,
    triggerHotkey: true,
    hotkey: DEFAULT_HOTKEY,
    triggerAutocomplete: false,
    autoSend: false,
    templates: [],
    myUserId: null,
    overlay: null,
    list: null,
    keydownHandler: null,
    outsideClickHandler: null,
    storageUnsub: null,
    selectedIdx: 0,
    filtered: [],
    pickerOpen: false,
    targetEl: null,
  };

  // peer_id для бесед: VK кодирует их как 2 000 000 000 + chat_id.
  const CHAT_PEER_OFFSET = 2_000_000_000;

  const vanityToPeerCache = new Map<string, number | null>();

  async function resolveVanityToPeerId(screenName: string): Promise<number | null> {
    const cached = vanityToPeerCache.get(screenName);
    if (cached !== undefined) return cached;
    try {
      const r = await vkApi.call('utils.resolveScreenName', { screen_name: screenName }) as
        { type?: string; object_id?: number } | null;
      let peerId: number | null = null;
      if (r && typeof r.object_id === 'number') {
        if (r.type === 'user') peerId = r.object_id;
        else if (r.type === 'group' || r.type === 'page' || r.type === 'application') peerId = -r.object_id;
      }
      vanityToPeerCache.set(screenName, peerId);
      return peerId;
    } catch {
      vanityToPeerCache.set(screenName, null);
      return null;
    }
  }

  function refresh(settings: Record<string, unknown>): void {
    state.triggerSlash         = settings['message_templates_trigger_slash']        !== false;
    state.triggerHotkey        = settings['message_templates_trigger_hotkey']       !== false;
    state.hotkey               = (settings['message_templates_hotkey'] as HotkeyCombo | undefined) ?? DEFAULT_HOTKEY;
    state.triggerAutocomplete  = settings['message_templates_trigger_autocomplete'] === true;
    state.autoSend             = settings['message_templates_auto_send']            === true;
    state.templates            = (settings['message_templates'] as MessageTemplate[] | undefined) ?? [];
    const myId = Number(settings[StorageKey.VK_USER_ID]);
    state.myUserId = Number.isFinite(myId) && myId > 0 ? myId : null;
  }

  // ── Контекст: только в IM ВК ─────────────────────────────────────────────

  function isImContext(el: Element | null): el is HTMLElement {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (!location.pathname.startsWith('/im')) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'textarea' || tag === 'input' || el.isContentEditable;
  }

  // ── Детектор активного диалога ───────────────────────────────────────────
  //
  // Тройная стратегия (peerId/имя резолвятся из любого источника):
  //   1. URL query — старый IM (vk.com/im?sel=…).
  //   2. URL path — Messenger Engine (vk.com/im/convo/<peerId>).
  //   3. DOM — заголовок ConvoHeader: avatar-ссылка `/id<N>` / `/club<N>` и
  //      текст ConvoTitle__author / PeerTitle__title.
  //
  // DOM-фолбэк критичен: на новом VK URL во многих случаях остаётся `/im`
  // (без peerId), и единственный надёжный источник — DOM шапки чата.

  interface PeerInfo {
    peerId: number | null;
    firstName: string;
    lastName: string;
    title: string;
  }

  async function detectPeer(): Promise<PeerInfo> {
    let peerId: number | null = null;

    // 1. ?sel= / ?peer= в query
    const sp = new URLSearchParams(location.search);
    const sel = sp.get('sel') ?? sp.get('peer');
    if (sel) {
      if (/^c\d+$/.test(sel)) peerId = CHAT_PEER_OFFSET + Number(sel.slice(1));
      else {
        const n = Number(sel);
        if (Number.isFinite(n) && n !== 0) peerId = n;
      }
    }

    // 2. /im/convo/<id> или /im/<id> в pathname
    if (peerId === null) {
      const m = location.pathname.match(/\/im(?:\/convo)?\/(-?\d+)/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n !== 0) peerId = n;
      }
    }

    // 3a. DOM: ConvoHeader → avatar link (`href="/id100"` и т.п.)
    const headerLink =
      document.querySelector<HTMLAnchorElement>('.ConvoHeader__info') ||
      document.querySelector<HTMLAnchorElement>('a[class*="ConvoHeader__info"]');
    if (peerId === null && headerLink) {
      const href = headerLink.getAttribute('href') ?? '';
      let m: RegExpMatchArray | null;
      if      ((m = href.match(/^\/id(\d+)/)))         peerId = Number(m[1]);
      else if ((m = href.match(/^\/club(\d+)/)))       peerId = -Number(m[1]);
      else if ((m = href.match(/^\/public(\d+)/)))     peerId = -Number(m[1]);
      else if ((m = href.match(/^\/im\?sel=c(\d+)/)))  peerId = CHAT_PEER_OFFSET + Number(m[1]);
      else if ((m = href.match(/^\/im\/convo\/(-?\d+)/))) peerId = Number(m[1]);
    }

    if (peerId === null && headerLink) {
      const href = headerLink.getAttribute('href') ?? '';
      const m = href.match(/^\/([A-Za-z0-9_.]+)\/?$/);
      if (m) {
        peerId = await resolveVanityToPeerId(m[1]);
      }
    }

    const headerScope = document.querySelector<HTMLElement>('.ConvoHeader');
    const titleEl =
      headerScope?.querySelector<HTMLElement>('.ConvoTitle__author') ||
      headerScope?.querySelector<HTMLElement>('.PeerTitle__title') ||
      document.querySelector<HTMLElement>('[data-testid="im_dialog_header_title"]') ||
      document.querySelector<HTMLElement>('[class*="ChatHeaderTitle__title"]') ||
      document.querySelector<HTMLElement>('[class*="DialogHeader__title"]');
    // `title="…"` атрибут — то же, что и textContent, но устойчив к truncate-у;
    // предпочитаем его, если он есть.
    const title = titleEl?.getAttribute('title')?.trim()
               || titleEl?.textContent?.trim()
               || '';

    // Раскладка title → first/last: для имён/фамилий ЛС работает «как ожидается»;
    // для бесед first_name = весь title (групповое название), last_name пустой —
    // это разумный fallback для тех, кто использует `%first_name%` в групповом чате.
    const parts = title.split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? '';
    const lastName  = parts.slice(1).join(' ');

    return { peerId, firstName, lastName, title };
  }

  // ── Подстановка переменных ───────────────────────────────────────────────

  async function applyVariables(text: string): Promise<string> {
    let out = text;
    const peer = await detectPeer();

    if (peer.peerId !== null) {
      out = out.replace(/%peer_id%/g, String(peer.peerId));
    }

    if (/%(first_name|last_name)%/.test(out)) {
      // По умолчанию — DOM-сплит на имя/фамилию. Если peer резолвлен,
      // уточняем через API: user → имя/фамилия раздельно; community →
      // название целиком в %first_name%, %last_name% пустой (для шаблонов
      // вида «Здравствуйте, %first_name%» в чате сообщества).
      let firstName = peer.firstName;
      let lastName  = peer.lastName;

      if (peer.peerId !== null) {
        if (peer.peerId > 0 && peer.peerId < CHAT_PEER_OFFSET) {
          const user = await vkApi.getUser(peer.peerId).catch(() => null);
          if (user) {
            firstName = user.firstName;
            lastName  = user.lastName;
          }
        } else if (peer.peerId < 0) {
          const group = await vkApi.getGroup(Math.abs(peer.peerId)).catch(() => null);
          const name = (group as { name?: string } | null)?.name;
          if (typeof name === 'string' && name.trim()) {
            firstName = name.trim();
            lastName  = '';
          } else if (peer.title) {
            // API недоступен (нет прав / нет токена) — берём заголовок из DOM
            // целиком как название сообщества, без сплита по пробелам.
            firstName = peer.title;
            lastName  = '';
          }
        }
      }

      out = out.replace(/%first_name%/g, firstName);
      out = out.replace(/%last_name%/g,  lastName);
    }

    if (/%title%/.test(out)) {
      out = out.replace(/%title%/g, peer.title);
    }

    if (state.myUserId !== null && /%(my_first_name|my_last_name)%/.test(out)) {
      const me = await vkApi.getUser(state.myUserId).catch(() => null);
      if (me) {
        out = out.replace(/%my_first_name%/g, me.firstName);
        out = out.replace(/%my_last_name%/g,  me.lastName);
      }
    }

    out = out
      .replace(/%time%/g, new Date().toLocaleTimeString('ru-RU'))
      .replace(/%date%/g, new Date().toLocaleDateString('ru-RU'))
      .replace(/%br%/g,   '\n')
      // Любые нерезолвленные плейсхолдеры схлопываем в пустую строку,
      // чтобы пользователь не отправил «Привет, %first_name%».
      .replace(/%(first_name|last_name|my_first_name|my_last_name|title|peer_id)%/g, '');

    return out;
  }

  // ── Работа с инпутом (React-controlled-safe) ─────────────────────────────

  function getInputText(el: HTMLElement): string {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
    return el.textContent ?? '';
  }

  /**
   * Программная установка значения React-controlled `<textarea>` /`<input>`
   * требует вызова native value-setter и диспетча InputEvent — иначе React не
   * увидит изменение и при следующем рендере перетрёт его старым state.
   */
  function setValueWithNativeSetter(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertAtCursor(el: HTMLElement, text: string): void {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const start = el.selectionStart ?? el.value.length;
      const end   = el.selectionEnd   ?? el.value.length;
      const next  = el.value.slice(0, start) + text + el.value.slice(end);
      setValueWithNativeSetter(el, next);
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
      return;
    }
    // contenteditable: execCommand формально deprecated, но в Chromium работает
    // и аккуратно стыкуется с React-Slate-обёртками, поднимая нужные события.
    document.execCommand('insertText', false, text);
  }

  function replaceFullText(el: HTMLElement, text: string): void {
    el.focus();
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      setValueWithNativeSetter(el, text);
      el.setSelectionRange(text.length, text.length);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('insertText', false, text);
  }

  // ── Overlay UI ───────────────────────────────────────────────────────────
  //
  // Архитектура UI:
  //   • Сам overlay создаётся один раз и переиспользуется (ensureOverlay).
  //   • Список перерисовывается только при изменении фильтра/набора шаблонов,
  //     а НЕ на каждый hover.
  //   • Выделение пункта при наведении — через смену CSS-класса .is-active
  //     у уже существующих узлов; DOM остаётся стабильным.
  //   • Обработчики click/mousemove — один на список (event delegation), не
  //     на каждую кнопку. mousedown(preventDefault) держит фокус на инпуте.
  //   • Стили вынесены в <style> с уникальными классами `vkify-tpl-*` — не
  //     конфликтуют ни с VKUI, ни с пользовательскими CSS.

  const STYLE_ID  = 'vkify-templates-picker-styles';
  const ROOT_ID   = 'vkify-templates-picker';
  const STYLE_CSS = `
    #${ROOT_ID} {
      position: fixed; z-index: 2147483646;
      display: none; flex-direction: column;
      width: 340px; max-height: 360px;
      background: #fff; color: #1d1d1f;
      border: 1px solid rgba(0,0,0,0.06);
      border-radius: 14px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06);
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      transform-origin: bottom left;
      animation: vkify-tpl-in .12s ease-out;
    }
    @keyframes vkify-tpl-in {
      from { opacity: 0; transform: translateY(4px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    #${ROOT_ID} .vkify-tpl-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px 8px;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }
    #${ROOT_ID} .vkify-tpl-header-icon {
      width: 24px; height: 24px; flex-shrink: 0;
      border-radius: 7px; background: linear-gradient(135deg, #0077ff, #0055cc);
      display: flex; align-items: center; justify-content: center; color: #fff;
      padding: 5px;
      box-shadow: 0 2px 8px rgba(0, 119, 255, 0.35);
    }
    #${ROOT_ID} .vkify-tpl-header-icon svg { width: 100%; height: 100%; }
    #${ROOT_ID} .vkify-tpl-header-close {
      width: 22px; height: 22px; flex-shrink: 0;
      border: none; background: transparent; cursor: pointer;
      border-radius: 6px; color: inherit; opacity: 0.5;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.1s ease, opacity 0.1s ease;
    }
    #${ROOT_ID} .vkify-tpl-header-close:hover {
      background: rgba(0, 0, 0, 0.06);
      opacity: 0.9;
    }
    #${ROOT_ID}.is-dark .vkify-tpl-header-close:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    #${ROOT_ID} .vkify-tpl-header-title {
      flex: 1; font-size: 13px; font-weight: 600;
    }
    #${ROOT_ID} .vkify-tpl-header-hint {
      font-size: 11px; opacity: 0.5;
    }
    #${ROOT_ID} .vkify-tpl-list {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 4px;
    }
    #${ROOT_ID} .vkify-tpl-item {
      display: flex; flex-direction: column; gap: 2px;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      user-select: none;
      transition: background 0.08s ease;
    }
    #${ROOT_ID} .vkify-tpl-item.is-active {
      background: rgba(0,119,255,0.10);
    }
    #${ROOT_ID} .vkify-tpl-item:hover {
      background: rgba(0,119,255,0.06);
    }
    #${ROOT_ID} .vkify-tpl-item.is-active:hover {
      background: rgba(0,119,255,0.14);
    }
    #${ROOT_ID} .vkify-tpl-name {
      font-weight: 600; font-size: 13px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${ROOT_ID} .vkify-tpl-preview {
      font-size: 11px; opacity: 0.55;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${ROOT_ID} .vkify-tpl-empty {
      padding: 22px 12px; text-align: center;
      font-size: 12px; opacity: 0.5;
    }
    #${ROOT_ID} .vkify-tpl-footer {
      display: flex; gap: 8px; flex-wrap: wrap;
      padding: 8px 14px;
      border-top: 1px solid rgba(0,0,0,0.05);
      font-size: 11px; opacity: 0.55;
    }
    #${ROOT_ID} .vkify-tpl-kbd {
      display: inline-flex; align-items: center; gap: 3px;
    }
    #${ROOT_ID} .vkify-tpl-kbd kbd {
      display: inline-block;
      padding: 1px 5px; font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: rgba(0,0,0,0.06);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 4px; color: inherit;
    }
    #${ROOT_ID}.is-dark {
      background: #1c1c1e; color: #f5f5f7;
      border-color: rgba(255,255,255,0.08);
      box-shadow: 0 12px 36px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.2);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-header,
    #${ROOT_ID}.is-dark .vkify-tpl-footer {
      border-color: rgba(255,255,255,0.06);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-item.is-active {
      background: rgba(94,181,255,0.16);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-item:hover {
      background: rgba(94,181,255,0.10);
    }
    #${ROOT_ID}.is-dark .vkify-tpl-kbd kbd {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.10);
    }
  `;

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function detectDarkMode(): boolean {
    // VK Messenger Engine ставит свой класс/атрибут темы на <html>/<body>;
    // на новом VK значащий маркер — `vkuiTokensClassNames__dark` либо background
    // самого ConvoMain. Простая эвристика: вычисленный фон body тёмный.
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5;
      }
    } catch { /* ignore */ }
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function ensureOverlay(): HTMLElement {
    if (state.overlay) return state.overlay;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE_CSS;
      document.head.appendChild(style);
    }

    const root = document.createElement('div');
    root.id = ROOT_ID;

    // Шапка — лого VKify (SVG) + заголовок + счётчик + кнопка закрытия.
    const header = document.createElement('div');
    header.className = 'vkify-tpl-header';
    header.innerHTML = `
      <div class="vkify-tpl-header-icon">
        <svg viewBox="0 0 231 148" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M73.711 1.83982L97.0564 57.5097C97.9202 59.5696 100.652 59.9968 102.103 58.2988L151.041 1.05066C151.611 0.383902 152.444 0 153.322 0H221.115C223.645 0 225.039 2.93882 223.438 4.898L107.853 146.382C107.275 147.089 106.408 147.494 105.496 147.484L63.8875 147.022C62.7028 147.008 61.6367 146.299 61.1668 145.211L0.249245 4.18967C-0.606304 2.2091 0.845833 0 3.00328 0H70.9444C72.153 0 73.2436 0.725252 73.711 1.83982Z" fill="currentColor"/>
          <path d="M138.702 122.916L173.168 82.1842C174.36 80.7756 176.529 80.7667 177.733 82.1655L229.675 142.544C231.349 144.488 229.967 147.5 227.401 147.5H160.202C159.395 147.5 158.621 147.175 158.057 146.597L138.848 126.952C137.766 125.845 137.703 124.098 138.702 122.916Z" fill="currentColor"/>
        </svg>
      </div>
      <div class="vkify-tpl-header-title">Шаблоны сообщений</div>
      <div class="vkify-tpl-header-hint" data-vkify-count>0</div>
      <button class="vkify-tpl-header-close" data-vkify-close aria-label="Закрыть">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    `;
    header.querySelector<HTMLButtonElement>('[data-vkify-close]')
      ?.addEventListener('click', () => closePicker());
    header.querySelector<HTMLButtonElement>('[data-vkify-close]')
      ?.addEventListener('mousedown', (e) => e.preventDefault());

    const list = document.createElement('div');
    list.className = 'vkify-tpl-list';

    // Подвал с подсказками клавиш.
    const footer = document.createElement('div');
    footer.className = 'vkify-tpl-footer';
    footer.innerHTML = `
      <span class="vkify-tpl-kbd"><kbd>↑</kbd><kbd>↓</kbd> выбор</span>
      <span class="vkify-tpl-kbd"><kbd>Enter</kbd> применить</span>
      <span class="vkify-tpl-kbd" data-vkify-hotkey-hint><kbd>Ctrl+Space</kbd> закрыть</span>
    `;

    root.append(header, list, footer);
    document.body.appendChild(root);

    if (detectDarkMode()) root.classList.add('is-dark');

    // Event delegation: один click/mousemove на весь список, элементы не
    // пересоздаются при hover — кнопка под курсором не «исчезает» во время
    // mousedown→click, и клик мышью гарантированно срабатывает.
    list.addEventListener('mousedown', (e) => {
      // Сохраняем фокус на VK-инпуте: без preventDefault клик на список
      // забирает фокус, и execCommand('insertText') теряет цель.
      const t = e.target as HTMLElement;
      if (t.closest('.vkify-tpl-item')) e.preventDefault();
    });
    list.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.vkify-tpl-item');
      if (!item) return;
      const idx = Number(item.dataset.idx);
      if (!Number.isFinite(idx)) return;
      state.selectedIdx = idx;
      void selectCurrent();
    });
    list.addEventListener('mousemove', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.vkify-tpl-item');
      if (!item) return;
      const idx = Number(item.dataset.idx);
      if (Number.isFinite(idx) && idx !== state.selectedIdx) {
        state.selectedIdx = idx;
        applySelectionClasses();
      }
    });

    state.overlay = root;
    state.list = list;

    state.outsideClickHandler = (e: MouseEvent) => {
      if (!state.pickerOpen) return;
      if (!root.contains(e.target as Node)) closePicker();
    };
    document.addEventListener('mousedown', state.outsideClickHandler, true);

    return root;
  }

  function applySelectionClasses(): void {
    if (!state.list) return;
    const items = state.list.querySelectorAll<HTMLElement>('.vkify-tpl-item');
    items.forEach((el, i) => {
      const isActive = i === state.selectedIdx;
      el.classList.toggle('is-active', isActive);
      if (isActive) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function renderList(): void {
    if (!state.list) return;

    // Счётчик в шапке.
    const countEl = state.overlay?.querySelector<HTMLElement>('[data-vkify-count]');
    if (countEl) countEl.textContent = String(state.filtered.length);

    // Подсказка хоткея в футере — синхронизируем с текущим биндингом.
    const hintEl = state.overlay?.querySelector<HTMLElement>('[data-vkify-hotkey-hint]');
    if (hintEl) hintEl.innerHTML = `<kbd>${escapeHtml(state.hotkey.label)}</kbd> закрыть`;

    if (state.filtered.length === 0) {
      state.list.innerHTML = `<div class="vkify-tpl-empty">Нет подходящих шаблонов</div>`;
      return;
    }

    // Один innerHTML — быстрее N appendChild'ов, плюс не нужны per-item listeners.
    state.list.innerHTML = state.filtered.map((t, i) => {
      const preview = t.text.length > 64 ? `${t.text.slice(0, 64)}…` : t.text;
      const active  = i === state.selectedIdx ? ' is-active' : '';
      return `<div class="vkify-tpl-item${active}" data-idx="${i}">`
           + `<div class="vkify-tpl-name">${escapeHtml(t.name)}</div>`
           + `<div class="vkify-tpl-preview">${escapeHtml(preview)}</div>`
           + `</div>`;
    }).join('');
  }

  function positionOverlay(target: HTMLElement): void {
    if (!state.overlay) return;
    const rect = target.getBoundingClientRect();
    const overlay = state.overlay;
    overlay.style.display = 'flex';
    // Чтобы корректно измерить высоту, кадр должен отрисоваться один раз.
    const height = Math.min(overlay.offsetHeight || 280, 360);
    const top = rect.top > height + 8
      ? rect.top - height - 6
      : rect.bottom + 6;
    overlay.style.top  = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
    overlay.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 360))}px`;
  }

  function openPicker(target: HTMLElement, prefix = ''): void {
    if (state.templates.length === 0) return;
    ensureOverlay();
    state.targetEl = target;
    state.pickerOpen = true;
    const q = prefix.toLowerCase();
    state.filtered = q
      ? state.templates.filter(t => t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q))
      : state.templates;
    state.selectedIdx = 0;
    renderList();
    positionOverlay(target);
  }

  function closePicker(): void {
    state.pickerOpen = false;
    state.targetEl = null;
    if (state.overlay) state.overlay.style.display = 'none';
  }

  async function selectCurrent(): Promise<void> {
    if (!state.pickerOpen) return;
    const tpl = state.filtered[state.selectedIdx];
    const target = state.targetEl;
    closePicker();
    if (!tpl || !target) return;

    const text = await applyVariables(tpl.text);

    // Авто-отправка: текст уходит в VK через messages.send, поле очищается.
    // Если peer_id не резолвлен или API упал — мягкий fallback на вставку,
    // чтобы пользователь не остался без своего шаблона.
    if (state.autoSend) {
      const peer = await detectPeer();
      if (peer.peerId !== null) {
        // random_id обязателен с API v5.90+ и гарантирует идемпотентность.
        try {
          await vkApi.call('messages.send', {
            peer_id: peer.peerId,
            message: text,
            random_id: Math.floor(Math.random() * 1_000_000_000),
          });
          // VK не очищает inputs за нас, очищаем сами (там сейчас «/» или префикс).
          replaceFullText(target, '');
          return;
        } catch (err) {
          console.warn('[VKify] Templates auto-send failed, inserting instead:', err);
        }
      }
    }

    // Стандартное поведение: просто вставить текст, дальше пользователь сам.
    const current = getInputText(target);
    if (current === '/' || current.trim() === '') {
      replaceFullText(target, text);
    } else {
      insertAtCursor(target, text);
    }
  }

  // ── Keyboard handler ─────────────────────────────────────────────────────

  function matchesHotkey(e: KeyboardEvent, combo: HotkeyCombo): boolean {
    return e.code === combo.code
        && (e.ctrlKey || e.metaKey) === combo.ctrlKey
        && e.shiftKey === combo.shiftKey
        && e.altKey   === combo.altKey;
  }

  function onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (!isImContext(target)) return;

    // Настраиваемый хоткей — открыть/закрыть пикер.
    if (state.triggerHotkey && matchesHotkey(e, state.hotkey)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (state.pickerOpen) closePicker(); else openPicker(target);
      return;
    }

    if (state.pickerOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopImmediatePropagation();
        state.selectedIdx = Math.min(state.selectedIdx + 1, state.filtered.length - 1);
        applySelectionClasses();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopImmediatePropagation();
        state.selectedIdx = Math.max(state.selectedIdx - 1, 0);
        applySelectionClasses();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && state.filtered.length > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void selectCurrent();
        return;
      }
      return;
    }

    // Слэш в начале строки — открывает пикер (без префикса).
    if (state.triggerSlash && e.key === '/' && getInputText(target).trim() === '') {
      // Не предотвращаем дефолт — пользователь видит '/' в поле, затем пикер
      // (selectCurrent сам сотрёт '/' заменой полного текста).
      setTimeout(() => openPicker(target, ''), 0);
      return;
    }

    // Автоподсказка по префиксу — деферим, чтобы прочитать новое значение поля.
    if (state.triggerAutocomplete) {
      setTimeout(() => {
        const text = getInputText(target).trim();
        if (!text) { if (state.pickerOpen) closePicker(); return; }
        const q = text.toLowerCase();
        const matches = state.templates.filter(t =>
          t.name.toLowerCase().startsWith(q) || t.text.toLowerCase().startsWith(q));
        if (matches.length > 0) openPicker(target, text);
        else if (state.pickerOpen) closePicker();
      }, 0);
    }
  }

  // ── Регистрация фичи ─────────────────────────────────────────────────────

  manager.register('message_templates_enabled', {
    enable: async () => {
      if (state.enabled) return;
      const settings = await manager.getAllSettings();
      refresh(settings);
      state.enabled = true;

      state.keydownHandler = onKeyDown;
      window.addEventListener('keydown', state.keydownHandler, true);

      state.storageUnsub = manager.onStorageChange((key) => {
        if (key === 'message_templates'
            || key.startsWith('message_templates_')
            || key === StorageKey.VK_USER_ID) {
          void manager.getAllSettings().then(refresh);
        }
      });

      console.log('[VKify] Message templates enabled');
    },

    disable: () => {
      if (!state.enabled) return;
      state.enabled = false;

      if (state.keydownHandler) {
        window.removeEventListener('keydown', state.keydownHandler, true);
        state.keydownHandler = null;
      }
      if (state.outsideClickHandler) {
        document.removeEventListener('mousedown', state.outsideClickHandler, true);
        state.outsideClickHandler = null;
      }
      state.storageUnsub?.();
      state.storageUnsub = null;

      closePicker();
      state.overlay?.remove();
      state.overlay = null;
      state.list = null;
      document.getElementById(STYLE_ID)?.remove();

      console.log('[VKify] Message templates disabled');
    },
  });
}