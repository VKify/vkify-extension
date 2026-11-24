import { migratePageWidgetPosition } from './migrate-widget-position.js';
import { mirrorDockedPosition } from './mirror-docked-position.js';
import { widgetIcon } from './widget-icons.js';
/**
 * FloatingWidget — единый базовый компонент для всех плавающих панелей VKify
 * поверх vk.ru (Центр загрузок, мини-монитор производительности и будущие).
 *
 * Берёт на себя весь «оконный» код, который раньше дублировался в каждом
 * виджете: внешний вид (полупрозрачный фон + blur, скругления, тень, анимация
 * открытия), перетаскивание за шапку с прижатием к экрану, сворачивание,
 * кнопку закрытия, дефолтное/умное размещение, управление z-index и
 * персист позиции.
 *
 * Базовый компонент НИЧЕГО не знает о содержимом — фича кладёт свой контент в
 * `body` и при необходимости — счётчик/статус в слот `aux` шапки.
 * Позиция хранится в widget:${id}.position; loadPosition/onPositionChange
 * позволяют явно переопределить чтение/сохранение для нестандартного поведения.
 *
 * Это не React-компонент: контент-скрипты VKify собирают DOM напрямую (без
 * виртуального DOM и бандла React в content), поэтому «компонент» здесь —
 * фабрика `createFloatingWidget`, возвращающая хэндл для управления панелью.
 */

import { widgetStack } from './widget-stack.js';
import { storage } from '@/content/core/storage.js';
import { positionKey, parseWidget } from '@/shared/widget-stack.js';

import { t, onLanguageChange } from '@/content/i18n/index.js';

export interface FloatingWidgetPosition {
  left: number;
  top: number;
}

/** Куда поставить виджет при первом открытии, если сохранённой позиции нет. */
export type FloatingWidgetPlacement =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | FloatingWidgetPosition;

export interface FloatingWidgetOptions {
  /** Уникальный id виджета — попадает в data-атрибут корня (для отладки/тестов). */
  id: string;
  /** Заголовок шапки. */
  title: string;
  /** Optional content-i18n key, refreshed when the language changes. */
  titleKey?: string;
  /** Иконка слева от заголовка (после «ручки» перетаскивания). */
  icon?: SVGElement | HTMLElement;
  /** Ширина панели в px (по умолчанию 240). */
  width?: number;
  /** Максимальная высота тела (любая CSS-длина, напр. '60vh'); тело скроллится. */
  maxHeight?: string;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  height?: number;
  onSizeChange?: (size: { width: number; height: number }) => void;
  /** Показывать кнопку «свернуть/развернуть» (по умолчанию false). */
  collapsible?: boolean;
  /** Стартовать в свёрнутом виде (для восстановления состояния). */
  startCollapsed?: boolean;
  /** Показывать кнопку закрытия (по умолчанию true). */
  closable?: boolean;
  /** Тултип кнопки закрытия. */
  closeTitle?: string;
  /** Размещение при первом открытии, если нет сохранённой позиции (по умолчанию center). */
  initialPosition?: FloatingWidgetPlacement;
  /** Сделать тело кликабельным (курсор-указатель + onBodyClick). */
  bodyClickable?: boolean;
  /** Тултип тела (актуально при bodyClickable). */
  bodyTitle?: string;
  /**
   * Загрузка сохранённой позиции. Может вернуть значение синхронно (localStorage)
   * или промис (chrome.storage) — база применит позицию, как только та будет
   * доступна, не блокируя появление панели.
   */
  loadPosition?: () => FloatingWidgetPosition | null | Promise<FloatingWidgetPosition | null>;
  /** Вызывается с финальной позицией при отпускании мыши (для персиста). */
  onPositionChange?: (pos: FloatingWidgetPosition) => void;
  /** Вызывается по кнопке закрытия. Если не задан — виджет просто удаляется. */
  onClose?: () => void;
  /** Вызывается при сворачивании/разворачивании (для персиста состояния). */
  onToggle?: (collapsed: boolean) => void;
  /** Вызывается по клику в тело (при bodyClickable). */
  onBodyClick?: () => void;
}

export interface FloatingWidgetHandle {
  /** Корневой элемент панели. */
  readonly root: HTMLElement;
  /** Шапка (зона перетаскивания). */
  readonly head: HTMLElement;
  /** Контейнер контента — сюда фича кладёт свой DOM. */
  readonly body: HTMLElement;
  /** Отдельная строка под заголовком для статуса или управления содержимым. */
  readonly aux: HTMLElement;
  /** Secondary window and feature actions, shown in the shared disclosure. */
  readonly actions: HTMLElement;
  /** Добавляет панель на страницу, применяет позицию, поднимает над другими. */
  mount(parent?: HTMLElement): void;
  /** Возвращает панель в DOM после SPA-навигации, не трогая позицию. */
  reattach(): void;
  /** Подключена ли панель к документу. */
  isMounted(): boolean;
  /** Показать панель (идемпотентно; анимация только на переходе скрыт→виден). */
  show(): void;
  /** Скрыть панель (идемпотентно). */
  hide(): void;
  /** Установить позицию; null — пересчитать дефолтное размещение. */
  setPosition(pos: FloatingWidgetPosition | null): void;
  /** Свернуть/развернуть. */
  setCollapsed(collapsed: boolean): void;
  isCollapsed(): boolean;
  /** Поднять виджет над остальными плавающими панелями. */
  bringToFront(): void;
  /** Полностью убрать панель и снять слушатели. */
  destroy(): void;
}

const FW_CSS_ID = 'vkify-floating-widget-css';
const EDGE = 16; // отступ от края экрана при дефолтном размещении

// Общий счётчик z-index: клик/маунт поднимает панель над остальными, не уезжая
// за допустимый максимум int32 (после потолка сбрасываемся к базе).
const Z_BASE = 2147483640;
const Z_MAX = 2147483646;
let zTop = Z_BASE;
function nextZ(): number {
  if (zTop >= Z_MAX) zTop = Z_BASE;
  return ++zTop;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

const FW_CSS = `
  @keyframes vkify-fw-in {
    from { opacity: 0; transform: translateY(10px) scale(.98); }
    to   { opacity: 1; transform: none; }
  }
  .vkify-fw {
    container-type: inline-size;
    position: fixed; z-index: ${Z_BASE};
    display: flex; flex-direction: column;
    background: color-mix(in srgb, var(--vkui--color_background_modal, #fff) 82%, transparent);
    -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
    color: var(--vkui--color_text_primary, #19191a);
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 14px 44px rgba(0,0,0,.3), 0 0 0 1px rgba(127,127,127,.14);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: vkify-fw-in .18s ease-out;
  }
  .vkify-fw.is-hidden { display: none; }
  .vkify-fw[data-auto-hide-edge] { transition: translate .18s ease-out; animation: none; }
  .vkify-fw[data-auto-hide-edge="left"] { translate: calc(-100% + 18px - var(--vkify-edge-gap,0px)) 0; }
  .vkify-fw[data-auto-hide-edge="right"] { translate: calc(100% - 18px + var(--vkify-edge-gap,0px)) 0; }
  .vkify-fw[data-auto-hide-edge="left"]:hover,
  .vkify-fw[data-auto-hide-edge="left"]:focus-within { translate: calc(0px - var(--vkify-edge-gap,0px)) 0; }
  .vkify-fw[data-auto-hide-edge="right"]:hover,
  .vkify-fw[data-auto-hide-edge="right"]:focus-within { translate: var(--vkify-edge-gap,0px) 0; }
  .vkify-fw[data-auto-hide-edge].is-dragging { translate: 0 0; }
  .vkify-fw > .vkify-fw__edge-handle { display: none; }
  .vkify-fw[data-auto-hide-edge] > .vkify-fw__edge-handle {
    display: flex; position: absolute; top: 0; bottom: 0; z-index: 3; width: 18px; padding: 0;
    align-items: center; justify-content: center; border: 0; border-radius: 0; cursor: pointer;
    color: var(--vkui--color_text_secondary,#818c99); background: var(--vkui--color_background_modal,#fff);
  }
  .vkify-fw__edge-handle::after { content: ''; width: 3px; height: 24px; max-height: 60%; border-radius: 2px; background: currentColor; }
  .vkify-fw[data-auto-hide-edge="left"] > .vkify-fw__edge-handle { right: 0; }
  .vkify-fw[data-auto-hide-edge="right"] > .vkify-fw__edge-handle { left: 0; }
  .vkify-fw[data-auto-hide-edge]:hover > .vkify-fw__edge-handle,
  .vkify-fw[data-auto-hide-edge]:focus-within > .vkify-fw__edge-handle,
  .vkify-fw[data-auto-hide-edge].is-dragging > .vkify-fw__edge-handle { opacity: 0; pointer-events: none; }
  .vkify-fw.is-dragging { animation: none; user-select: none; cursor: grabbing; }
  .vkify-fw__head {
    display: grid; grid-template-columns:24px minmax(0,1fr) auto; align-items: center; gap: 6px; padding: 8px 10px;
    font-size: 12px; font-weight: 700; cursor: move; touch-action: none;
    border-bottom: 1px solid rgba(127,127,127,.16); flex-shrink: 0;
  }
  .vkify-fw.is-collapsed .vkify-fw__head { border-bottom: 0; }
  .vkify-fw__grip { color: var(--vkui--color_icon_tertiary, #99a2ad); flex: 0 0 auto; display: block; }
  .vkify-fw__icon { flex: 0 0 auto; display: flex; align-items: center; }
  .vkify-fw__identity { display:flex; align-items:center; gap:6px; min-width:0; }
  .vkify-fw__identity { grid-column:2; grid-row:1; }
  .vkify-fw__head > :is(.vkify-fw__grip,.vkify-reorder-handle) { grid-column:1; grid-row:1; }
  .vkify-fw__title { min-width:0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vkify-fw__aux {
    grid-column:1/-1; grid-row:2; display: flex; flex-wrap:wrap; align-items: center; gap: 6px;
    min-width: 0; font-weight: 600;
  }
  .vkify-fw__aux:empty { display:none; }
  .vkify-fw__aux > * { min-width:0; max-width:100%; overflow-wrap:anywhere; }
  .vkify-fw__controls { grid-column:3; grid-row:1; display:flex; align-items:center; gap:4px; }
  .vkify-fw__head .vkify-fw__controls > button { display:grid; place-items:center; flex:none; width:32px; height:32px; padding:0; }
  .vkify-fw__menu {
    position:fixed; inset:auto; margin:0; padding:6px; border:1px solid var(--vkui--color_separator_primary,#dce1e6);
    border-radius:14px; min-width:180px; max-width:calc(100vw - 16px); max-height:calc(100vh - 16px); overflow:auto;
    background:var(--vkui--color_background_modal,#fff); color:var(--vkui--color_text_primary,#19191a);
    box-shadow:0 12px 36px #0004; font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }
  .vkify-fw__menu[hidden] { display:none!important; }
  .vkify-fw__menu button { display:flex!important; position:static!important; align-items:center; justify-content:flex-start; gap:10px;
    width:100%!important; height:auto!important; min-height:36px; padding:8px 10px!important; border:0; border-radius:8px; background:transparent; color:inherit; cursor:pointer; }
  .vkify-fw__menu button::after { content:attr(aria-label); flex:1; min-width:0; overflow-wrap:anywhere; white-space:normal; text-align:start; font:inherit; }
  .vkify-fw__menu button:hover { background:color-mix(in srgb,currentColor 8%,transparent); }
  .vkify-fw__menu button:focus-visible { outline:2px solid var(--vkui--color_stroke_accent,#2688eb); outline-offset:-2px; }
  .vkify-fw__btn {
    flex: 0 0 auto; border: 0; background: transparent; cursor: pointer;
    padding: 2px 5px; border-radius: 6px; line-height: 1;
    color: var(--vkui--color_text_secondary, #818c99); font-size: 13px;
  }
  .vkify-fw__btn:hover { background: rgba(127,127,127,.14); }
  .vkify-fw__body { min-height: 0; overflow-y: auto; }
  .vkify-fw.is-collapsed .vkify-fw__body { display: none; }
  .vkify-fw__body.is-clickable { cursor: pointer; }
`;

/** Внедряет общие стили плавающих панелей (идемпотентно). */
export function ensureFloatingWidgetStyles(): void {
  if (document.getElementById(FW_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = FW_CSS_ID;
  s.textContent = FW_CSS;
  document.head.appendChild(s);
}

/** Удаляет общие стили (для тестов/жёсткой очистки). */
export function removeFloatingWidgetStyles(): void {
  document.getElementById(FW_CSS_ID)?.remove();
}

/** «Ручка» перетаскивания (полосы) — affordance шапки. Единый источник иконки. */
export function buildDragGrip(size = 16): SVGSVGElement {
  const svg = widgetIcon('grip', size);
  svg.classList.add('vkify-fw__grip');
  return svg;
}

/** Вычисляет дефолтную позицию по ключевому слову размещения. */
function defaultPosition(
  placement: FloatingWidgetPlacement | undefined,
  w: number,
  h: number,
): FloatingWidgetPosition {
  if (placement && typeof placement === 'object') return placement;
  const maxLeft = Math.max(0, window.innerWidth - w);
  const maxTop = Math.max(0, window.innerHeight - h);
  switch (placement) {
    case 'top-left': return { left: EDGE, top: EDGE };
    case 'top-right': return { left: Math.max(0, maxLeft - EDGE), top: EDGE };
    case 'bottom-left': return { left: EDGE, top: Math.max(0, maxTop - EDGE) };
    case 'bottom-right': return { left: Math.max(0, maxLeft - EDGE), top: Math.max(0, maxTop - EDGE) };
    case 'center':
    default: return { left: Math.round(maxLeft / 2), top: Math.round(maxTop / 2) };
  }
}

/**
 * Создаёт плавающую панель. Возвращает хэндл — всё изменяемое состояние живёт в
 * замыкании, без глобальных модульных переменных (кроме общего z-счётчика).
 */
export async function saveWidgetPosition(id: string, position: FloatingWidgetPosition | null): Promise<void> {
  const values = await storage.getMultiple([positionKey(id)]);
  await storage.set(positionKey(id), { ...parseWidget(values[positionKey(id)]), position });
}

export function createFloatingWidget(opts: FloatingWidgetOptions): FloatingWidgetHandle {
  ensureFloatingWidgetStyles();

  let current: FloatingWidgetPosition | null = null;
  let destroyed = false;
  let offStack: (() => void) | null = null;
  let offPosition: (() => void) | null = null;
  let positionRevision = 0;
  let collapsed = opts.startCollapsed ?? false;
  let hidden = false;
  let resizeBound = false;
  let stopDrag: (() => void) | null = null;
  let autoHide = false;

  // ── Корень ────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'vkify-fw';
  root.setAttribute('data-vkify-widget', opts.id);
  root.style.width = `${opts.width ?? 240}px`;

  let expandedHeight = opts.height ?? 280;
  if (opts.resizable) {
    Object.assign(root.style, { resize: 'both', minWidth: `${opts.minWidth ?? 220}px`, minHeight: `${opts.minHeight ?? 160}px`, maxWidth: '100vw', maxHeight: '100vh', height: expandedHeight + 'px' });
  }
  let sizeTimer: ReturnType<typeof setTimeout> | undefined;
  const sizeObserver = opts.resizable ? new ResizeObserver(() => {
    if (collapsed || !root.isConnected || root.classList.contains('is-stacked')) return;
    place(current);
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => {
      if (collapsed || !root.isConnected || root.classList.contains('is-stacked')) return;
      expandedHeight = root.offsetHeight;
      opts.onSizeChange?.({ width: root.offsetWidth, height: expandedHeight });
    }, 250);
  }) : null;

  // ── Шапка ─────────────────────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'vkify-fw__head';
  head.appendChild(buildDragGrip());
  const identity = document.createElement('div'); identity.className = 'vkify-fw__identity'; head.append(identity);

  if (opts.icon) {
    const ic = document.createElement('span');
    ic.className = 'vkify-fw__icon';
    ic.appendChild(opts.icon);
    identity.appendChild(ic);
  }

  const title = document.createElement('span');
  title.className = 'vkify-fw__title';
  title.textContent = opts.titleKey ? t(opts.titleKey) : opts.title;
  identity.appendChild(title);

  const aux = document.createElement('span');
  aux.className = 'vkify-fw__aux';
  head.appendChild(aux);
  const controls = document.createElement('div'); controls.className = 'vkify-fw__controls'; head.append(controls);
  const actions = document.createElement('div'); actions.className = 'vkify-fw__menu';
  actions.setAttribute('role', 'group');
  actions.setAttribute('popover', 'auto'); actions.dataset.widgetActions = '';
  actions.id = `vkify-widget-actions-${opts.id}`;
  const nativePopover = typeof actions.showPopover === 'function';
  if (!nativePopover) { actions.removeAttribute('popover'); actions.hidden = true; }
  let actionsOpen = false;
  let dismissActions: AbortController | undefined;
  const more = document.createElement('button'); more.type = 'button'; more.className = 'vkify-fw__btn';
  more.dataset.widgetMore = '';
  const dots = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  dots.setAttribute('viewBox', '0 0 24 24'); dots.setAttribute('width', '16'); dots.setAttribute('height', '16');
  dots.setAttribute('aria-hidden', 'true'); dots.setAttribute('focusable', 'false');
  for (const x of [5, 12, 19]) {
    const dot = document.createElementNS(dots.namespaceURI, 'circle');
    dot.setAttribute('cx', String(x)); dot.setAttribute('cy', '12'); dot.setAttribute('r', '1.8'); dot.setAttribute('fill', 'currentColor');
    dots.append(dot);
  }
  more.append(dots);
  more.setAttribute('aria-controls', actions.id); more.setAttribute('aria-expanded', 'false');
  const closeActions = (): void => {
    if (!actionsOpen) return;
    const restoreFocus = actions.contains(document.activeElement);
    actionsOpen = false;
    dismissActions?.abort();
    if (nativePopover) actions.hidePopover();
    else { actions.hidden = true; root.append(actions); }
    more.setAttribute('aria-expanded', 'false');
    if (restoreFocus && root.isConnected) more.focus({preventScroll:true});
  };
  more.addEventListener('click', () => {
    if (actionsOpen) { closeActions(); return; }
    const bounds = more.getBoundingClientRect();
    actionsOpen = true;
    more.setAttribute('aria-expanded', 'true');
    if (nativePopover) actions.showPopover();
    else {
      // Firefox ESR without Popover API: portal only while open, preserving
      // inherited theme colors and keeping the menu outside overflow clips.
      const paint = getComputedStyle(actions);
      Object.assign(actions.style, {color:paint.color,backgroundColor:paint.backgroundColor,zIndex:String(Z_MAX)});
      document.body.append(actions); actions.hidden = false;
      dismissActions = new AbortController();
      document.addEventListener('pointerdown', event => {
        if (!actions.contains(event.target as Node) && !more.contains(event.target as Node)) closeActions();
      }, {signal:dismissActions.signal});
    }
    const menu = actions.getBoundingClientRect();
    actions.style.left = `${clamp(bounds.right - menu.width, 8, Math.max(8, innerWidth - menu.width - 8))}px`;
    actions.style.top = `${bounds.bottom + menu.height + 8 <= innerHeight ? bounds.bottom + 6 : Math.max(8, bounds.top - menu.height - 6)}px`;
    actions.querySelector<HTMLButtonElement>('button')?.focus();
  });
  actions.addEventListener('toggle', event => {
    actionsOpen = (event as Event & {newState:string}).newState === 'open';
    more.setAttribute('aria-expanded', String(actionsOpen));
  });
  actions.addEventListener('pointerdown', event => {
    if ((event.target as Element).closest('[data-stack-toggle],[data-fw-close]')) queueMicrotask(closeActions);
  }, true);
  actions.addEventListener('click', event => { if ((event.target as Element).closest('button')) closeActions(); });
  actions.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeActions(); more.focus(); }
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;
    const buttons = [...actions.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    if (!buttons.length) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus();
  });

  // ── Тело ──────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'vkify-fw__body';
  if (opts.maxHeight) body.style.maxHeight = opts.maxHeight;
  if (opts.bodyClickable) {
    body.classList.add('is-clickable');
    if (opts.bodyTitle) body.title = opts.bodyTitle;
    body.addEventListener('click', () => opts.onBodyClick?.());
  }

  const edgeHandle = document.createElement('button');
  edgeHandle.type = 'button';
  edgeHandle.className = 'vkify-fw__btn vkify-fw__edge-handle';
  edgeHandle.tabIndex = -1;
  edgeHandle.addEventListener('pointerdown', event => event.stopPropagation());
  edgeHandle.addEventListener('click', () => { bringToFront(); edgeHandle.focus({ preventScroll: true }); });
  root.append(head, body, edgeHandle, actions);
  const autoHideObserver = new ResizeObserver(() => updateAutoHide());
  if (opts.resizable) body.style.flex = '1';

  // ── Сворачивание ────────────────────────────────────────────────────────────
  function applyCollapsed(): void {
    root.classList.toggle('is-collapsed', collapsed);
    if (opts.resizable) {
      root.style.resize = collapsed ? 'none' : 'both';
      root.style.minHeight = collapsed ? '0' : `${opts.minHeight ?? 160}px`;
      root.style.height = collapsed ? 'auto' : expandedHeight + 'px';
    }
  }
  function setCollapsed(next: boolean): void {
    if (collapsed === next) return;
    collapsed = next;
    applyCollapsed();
    collapseBtn?.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn?.setAttribute('aria-label', t(collapsed ? 'widget.expand' : 'widget.collapse'));
    opts.onToggle?.(collapsed);
  }
  applyCollapsed();

  let collapseBtn: HTMLButtonElement | null = null;
  if (opts.collapsible) {
    collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'vkify-fw__btn';
    collapseBtn.dataset.fwCollapse = '';
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    collapseBtn.setAttribute('aria-label', t('widget.collapse'));
    collapseBtn.title = t('widget.collapse_toggle');
    const sync = (): void => { collapseBtn!.replaceChildren(widgetIcon(collapsed ? 'expand' : 'collapse')); };
    sync();
    // pointerdown (не click): не запускаем перетаскивание шапки и не теряем клик
    // при частых ре-рендерах тела.
    collapseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setCollapsed(!collapsed);
      sync();
    });
    collapseBtn.addEventListener('click', e => { if (e.detail === 0) { setCollapsed(!collapsed); sync(); } });
    controls.appendChild(collapseBtn);
  }

  // ── Закрытие ────────────────────────────────────────────────────────────────
  if (opts.closable ?? true) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.dataset.fwClose = '';
    closeBtn.className = 'vkify-fw__btn';
    closeBtn.setAttribute('aria-label', t('widget.close'));
    closeBtn.title = opts.closeTitle ?? t('widget.close');
    closeBtn.append(widgetIcon('close'));
    closeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (opts.onClose) opts.onClose();
      else destroy();
    });
    closeBtn.addEventListener('click', e => { if (e.detail === 0) { if (opts.onClose) opts.onClose(); else destroy(); } });
    actions.appendChild(closeBtn);
  }
  controls.append(more);

  const refreshLabels = (): void => {
    if (opts.titleKey) title.textContent = t(opts.titleKey);
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-label', t(collapsed ? 'widget.expand' : 'widget.collapse'));
      collapseBtn.title = t('widget.collapse_toggle');
    }
    more.setAttribute('aria-label', t('widget.actions'));
    actions.setAttribute('aria-label', t('widget.actions'));
    const close = actions.querySelector<HTMLButtonElement>('[data-fw-close]');
    if (close) { close.setAttribute('aria-label', t('widget.close')); close.title = opts.closeTitle ?? t('widget.close'); }
    if (opts.resizable) body.title = t('widget.resize');
    edgeHandle.title = t('widget.reveal', { title: title.textContent ?? opts.title });
    edgeHandle.setAttribute('aria-label', edgeHandle.title);
  };
  refreshLabels();
  const offLanguage = onLanguageChange(refreshLabels);

  // ── Позиционирование ──────────────────────────────────────────────────────
  function updateAutoHide(): void {
    // Disabled and stacked panels need no geometry. This path is also called
    // by stack reconciliation, after other panels' styles have changed.
    const eligible = autoHide && current && !root.classList.contains('is-stacked');
    const width = eligible ? root.offsetWidth || opts.width || 240 : 0;
    const leftGap = Math.max(0, current?.left ?? 0);
    const rightGap = Math.max(0, window.innerWidth - leftGap - width);
    const edge = eligible && width > 18
      ? (leftGap <= rightGap && leftGap <= 32 ? 'left' : rightGap <= 32 ? 'right' : null) : null;
    if (edge) {
      if (root.dataset.autoHideEdge !== edge) root.dataset.autoHideEdge = edge;
      const gap = `${edge === 'left' ? leftGap : rightGap}px`;
      if (root.style.getPropertyValue('--vkify-edge-gap') !== gap) root.style.setProperty('--vkify-edge-gap', gap);
    } else {
      if (root.hasAttribute('data-auto-hide-edge')) delete root.dataset.autoHideEdge;
      if (root.style.getPropertyValue('--vkify-edge-gap')) root.style.removeProperty('--vkify-edge-gap');
    }
    if (edgeHandle.tabIndex !== (edge ? 0 : -1)) edgeHandle.tabIndex = edge ? 0 : -1;
  }

  function place(pos: FloatingWidgetPosition | null): void {
    if (root.classList.contains('is-stacked')) { current = pos; updateAutoHide(); return; }
    const w = root.offsetWidth || opts.width || 240;
    const h = root.offsetHeight || 0;
    const target = pos ?? defaultPosition(opts.initialPosition, w, h);
    current = {
      left: clamp(target.left, 0, Math.max(0, window.innerWidth - w)),
      top: clamp(target.top, 0, Math.max(0, window.innerHeight - h)),
    };
    root.style.left = `${current.left}px`;
    root.style.top = `${current.top}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    updateAutoHide();
  }

  const onResize = (): void => { closeActions(); if (current) place(current); };

  // ── Перетаскивание (за шапку) ─────────────────────────────────────────────
  head.addEventListener('pointerdown', (e: PointerEvent) => {
    const t = e.target as Element | null;
    if (widgetStack.isStacked(opts.id) || e.button !== 0 || t?.closest('button,input,select,a')) return; // не мешаем кнопкам шапки
    e.preventDefault();
    bringToFront();

    stopDrag?.();
    const rect = root.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    if (root.dataset.autoHideEdge) {
      // Start dragging from the revealed edge position, without a gap-sized jump.
      current = { left: rect.left, top: rect.top };
      root.style.left = `${current.left}px`;
      root.style.top = `${current.top}px`;
      updateAutoHide();
    }
    root.classList.add('is-dragging');

    const move = (ev: PointerEvent): void => {
      current = {
        left: clamp(ev.clientX - offX, 0, window.innerWidth - root.offsetWidth),
        top: clamp(ev.clientY - offY, 0, window.innerHeight - root.offsetHeight),
      };
      root.style.left = `${current.left}px`;
      root.style.top = `${current.top}px`;
      updateAutoHide();
    };
    const up = (): void => {
      root.classList.remove('is-dragging');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      stopDrag = null;
      // Персист — только на отпускании (одна запись на drag, не на каждый кадр).
      if (current && !destroyed) {
        if (autoHide && document.documentElement.hasAttribute('data-vkify-sidebar_right')) {
          place(mirrorDockedPosition(current, root.offsetWidth, window.innerWidth, true));
        }
        positionRevision++;
        if (opts.onPositionChange) opts.onPositionChange(current);
        else void saveWidgetPosition(opts.id, current).catch(() => {});
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    stopDrag = up;
  });

  // Клик в любом месте панели поднимает её над остальными.
  root.addEventListener('pointerdown', () => bringToFront());

  // ── Публичный хэндл ───────────────────────────────────────────────────────
  function bringToFront(): void {
    root.style.zIndex = String(nextZ());
  }

  function mount(parent: HTMLElement = document.body): void {
    if (destroyed) return;
    ensureFloatingWidgetStyles();
    if (offStack) { reattach(); return; }
    if (!root.isConnected) parent.appendChild(root);
    bringToFront();

    // Дефолтная позиция применяется сразу (без «прыжка» из угла); сохранённая —
    // как только загрузчик её отдаст (синхронно для localStorage, позже для chrome.storage).
    sizeObserver?.observe(root);
    autoHideObserver.observe(root);
    offPosition = storage.onChange((key, value) => {
      if (key !== positionKey(opts.id)) return;
      positionRevision++;
      place(parseWidget(value).position);
    });
    const revision = positionRevision;
    const loaded = opts.loadPosition ? opts.loadPosition() : migratePageWidgetPosition(opts.id).then(() => storage.get(positionKey(opts.id))).then(value => parseWidget(value).position);
    if (loaded instanceof Promise) {
      place(null);
      loaded.then((p) => { if (p && !destroyed && revision === positionRevision) place(p); }).catch(() => { /* нет доступа — оставляем дефолт */ });
    } else {
      place(loaded ?? null);
    }

    offStack = widgetStack.register({ id: opts.id, title: opts.title, root, head, actions,
      setPosition: pos => { positionRevision++; place(pos); }, restorePosition: () => place(current), dispose: destroy, cancelDrag: () => stopDrag?.(),
      setAutoHide: enabled => { autoHide = enabled; updateAutoHide(); },
    });

    if (!resizeBound) {
      window.addEventListener('resize', onResize);
      resizeBound = true;
    }
  }

  function reattach(): void {
    if (destroyed || root.isConnected) return;
    widgetStack.refresh();
    if (!root.isConnected && document.body) document.body.appendChild(root);
  }

  function show(): void {
    if (!hidden) return; // идемпотентно: не перезапускаем анимацию на каждый рендер
    hidden = false;
    root.classList.remove('is-hidden');
    widgetStack.refresh();
    // Перезапуск keyframe-анимации появления (reflow между none и '').
    root.style.animation = 'none';
    void root.offsetHeight;
    root.style.animation = '';
  }

  function hide(): void {
    if (hidden) return;
    hidden = true;
    closeActions();
    root.classList.add('is-hidden');
    widgetStack.refresh();
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    closeActions();
    offLanguage();
    offPosition?.(); offPosition = null;
    stopDrag?.();
    offStack?.(); offStack = null;
    sizeObserver?.disconnect(); clearTimeout(sizeTimer);
    autoHideObserver.disconnect();
    if (resizeBound) { window.removeEventListener('resize', onResize); resizeBound = false; }
    root.remove();
  }

  return {
    root, head, body, aux, actions,
    mount, reattach,
    isMounted: () => root.isConnected,
    show, hide,
    setPosition: (pos) => { positionRevision++; place(pos); },
    setCollapsed: (c) => {
      setCollapsed(c);
      if (collapseBtn) collapseBtn.replaceChildren(widgetIcon(collapsed ? 'expand' : 'collapse'));
    },
    isCollapsed: () => collapsed,
    bringToFront,
    destroy,
  };
}
