/**
 * Создание и переиспользование оверлея-пикера.
 *
 * Архитектура UI:
 *   • Оверлей создаётся один раз и переиспользуется (ensureOverlay).
 *   • Список перерисовывается только при изменении фильтра/набора (render.ts),
 *     а НЕ на каждый hover.
 *   • Обработчики click/mousemove/mousedown — один на список (event delegation),
 *     а конкретные действия проброшены наружу через OverlayHandlers, чтобы этот
 *     модуль не зависел от логики пикера/клавиатуры. mousedown(preventDefault)
 *     держит фокус на VK-инпуте.
 *   • Стили — в <style> с уникальными классами `vkify-tpl-*` (styles.ts).
 */

import { ROOT_ID, STYLE_ID } from './constants.js';
import { STYLE_CSS } from './styles.js';
import type { TemplatesState } from './state.js';

export interface OverlayHandlers {
  /** Закрыть пикер (кнопка-крест, клик вне оверлея). */
  onClose: () => void;
  /** Применить выбранный шаблон (клик по пункту). */
  onSelect: () => void;
  /** Навести курсор на пункт idx (обновить подсветку). */
  onHover: (idx: number) => void;
}

/** Эвристика тёмной темы по фону body — VK не даёт надёжного флага темы. */
function detectDarkMode(): boolean {
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

export function ensureOverlay(state: TemplatesState, handlers: OverlayHandlers): HTMLElement {
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
  const closeBtn = header.querySelector<HTMLButtonElement>('[data-vkify-close]');
  closeBtn?.addEventListener('click', () => handlers.onClose());
  closeBtn?.addEventListener('mousedown', (e) => e.preventDefault());

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
    handlers.onSelect();
  });
  list.addEventListener('mousemove', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.vkify-tpl-item');
    if (!item) return;
    const idx = Number(item.dataset.idx);
    if (Number.isFinite(idx) && idx !== state.selectedIdx) handlers.onHover(idx);
  });

  state.overlay = root;
  state.list = list;

  state.outsideClickHandler = (e: MouseEvent) => {
    if (!state.pickerOpen) return;
    if (!root.contains(e.target as Node)) handlers.onClose();
  };
  document.addEventListener('mousedown', state.outsideClickHandler, true);

  return root;
}
