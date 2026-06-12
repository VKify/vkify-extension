import type { FeatureManager } from '../../../../core/feature-manager.js';
import { vkApi } from '../../../../api/vk-api-client.js';
import { StorageKey } from '../../../../../shared/constants/storage-keys.js';
import type { MessageTemplate, HotkeyCombo } from '../../../../../types/index.js';
import { escapeHtml } from '../../../../../shared/utils/html.js';
import { DEFAULT_HOTKEY, ROOT_ID, STYLE_ID } from './constants.js';
import { STYLE_CSS } from './styles.js';
import { detectPeer } from './peer.js';
import { applyVariables } from './variables.js';
import { getInputText, insertAtCursor, replaceFullText } from './input.js';
import { attachFilesToInput } from './attachments.js';

/**
 * Шаблоны сообщений: оверлей-пикер над инпутом ВК-чата с переменными
 * (%first_name%, %last_name%, %my_first_name%, %my_last_name%, %title%,
 * %peer_id%, %time%, %date%, %br%) и тремя триггерами (слэш в начале строки,
 * Ctrl+Space, опциональная автоподсказка по префиксу).
 *
 * Фича собрана из модулей: peer · variables · input · attachments · styles.
 * Здесь — состояние пикера, оверлей, клавиатура и регистрация.
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
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7.536 6.264a.9.9 0 0 0-1.272 1.272L10.727 12l-4.463 4.464a.9.9 0 0 0 1.272 1.272L12 13.273l4.464 4.463a.9.9 0 1 0 1.272-1.272L13.273 12l4.463-4.464a.9.9 0 1 0-1.272-1.272L12 10.727z"/></svg>
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
      const attachCount = t.attachments?.length ?? 0;
      const attachBadge = attachCount > 0 ? ` 📎${attachCount}` : '';
      return `<div class="vkify-tpl-item${active}" data-idx="${i}">`
           + `<div class="vkify-tpl-name">${escapeHtml(t.name)}${attachBadge}</div>`
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

    const text = await applyVariables(tpl.text, state.myUserId);
    const attachments = tpl.attachments ?? [];

    // Авто-отправка: текст уходит в VK через messages.send, поле очищается.
    // Если peer_id не резолвлен или API упал — мягкий fallback на вставку,
    // чтобы пользователь не остался без своего шаблона.
    // Шаблоны с файлами не авто-отправляются: вложения идут через нативный
    // механизм загрузки композера (см. attachFilesToInput), и пользователь
    // подтверждает отправку сам.
    if (state.autoSend && attachments.length === 0) {
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

    if (attachments.length > 0) {
      attachFilesToInput(target, attachments);
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
