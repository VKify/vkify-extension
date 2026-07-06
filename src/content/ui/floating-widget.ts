/**
 * FloatingWidget — единый базовый компонент для всех плавающих панелей VKify
 * поверх vk.com (Центр загрузок, мини-монитор производительности и будущие).
 *
 * Берёт на себя весь «оконный» код, который раньше дублировался в каждом
 * виджете: внешний вид (полупрозрачный фон + blur, скругления, тень, анимация
 * открытия), перетаскивание за шапку с прижатием к экрану, сворачивание,
 * кнопку закрытия, дефолтное/умное размещение, управление z-index и
 * персист позиции.
 *
 * Базовый компонент НИЧЕГО не знает о содержимом — фича кладёт свой контент в
 * `body` и при необходимости — счётчик/статус в слот `aux` шапки. Персист
 * позиции пробрасывается колбэками (`loadPosition`/`onPositionChange`), поэтому
 * один виджет может хранить позицию в настройках (`perfWidgetPosition`), а
 * другой — в localStorage: база остаётся независимой от способа хранения.
 *
 * Это не React-компонент: контент-скрипты VKify собирают DOM напрямую (без
 * виртуального DOM и бандла React в content), поэтому «компонент» здесь —
 * фабрика `createFloatingWidget`, возвращающая хэндл для управления панелью.
 */

import { t } from '@/content/i18n/index.js';

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
  /** Иконка слева от заголовка (после «ручки» перетаскивания). */
  icon?: SVGElement | HTMLElement;
  /** Ширина панели в px (по умолчанию 240). */
  width?: number;
  /** Максимальная высота тела (любая CSS-длина, напр. '60vh'); тело скроллится. */
  maxHeight?: string;
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
  /** Слот в шапке между заголовком и кнопками (счётчик/статус). */
  readonly aux: HTMLElement;
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

const SVG_NS = 'http://www.w3.org/2000/svg';
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
  .vkify-fw.is-dragging { animation: none; user-select: none; cursor: grabbing; }
  .vkify-fw__head {
    display: flex; align-items: center; gap: 6px; padding: 8px 10px;
    font-size: 12px; font-weight: 700; cursor: move; touch-action: none;
    border-bottom: 1px solid rgba(127,127,127,.16); flex-shrink: 0;
  }
  .vkify-fw.is-collapsed .vkify-fw__head { border-bottom: 0; }
  .vkify-fw__grip { color: var(--vkui--color_icon_tertiary, #99a2ad); flex: 0 0 auto; display: block; }
  .vkify-fw__icon { flex: 0 0 auto; display: flex; align-items: center; }
  .vkify-fw__title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vkify-fw__aux {
    margin-left: auto; display: flex; align-items: center; gap: 6px;
    min-width: 0; font-weight: 600;
  }
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
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'vkify-fw__grip');
  svg.style.cssText = `width:${size}px;height:${size}px`;
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute(
    'd',
    'M3.9 9.2a.9.9 0 1 0 0 1.8h16.2a.9.9 0 1 0 0-1.8H3.9Zm0 3.8a.9.9 0 1 0 0 1.8h16.2a.9.9 0 1 0 0-1.8H3.9Z',
  );
  svg.appendChild(p);
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
export function createFloatingWidget(opts: FloatingWidgetOptions): FloatingWidgetHandle {
  ensureFloatingWidgetStyles();

  let current: FloatingWidgetPosition | null = null;
  let collapsed = opts.startCollapsed ?? false;
  let hidden = false;
  let resizeBound = false;

  // ── Корень ────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'vkify-fw';
  root.setAttribute('data-vkify-widget', opts.id);
  root.style.width = `${opts.width ?? 240}px`;

  // ── Шапка ─────────────────────────────────────────────────────────────────
  const head = document.createElement('div');
  head.className = 'vkify-fw__head';
  head.appendChild(buildDragGrip());

  if (opts.icon) {
    const ic = document.createElement('span');
    ic.className = 'vkify-fw__icon';
    ic.appendChild(opts.icon);
    head.appendChild(ic);
  }

  const title = document.createElement('span');
  title.className = 'vkify-fw__title';
  title.textContent = opts.title;
  head.appendChild(title);

  const aux = document.createElement('span');
  aux.className = 'vkify-fw__aux';
  head.appendChild(aux);

  // ── Тело ──────────────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'vkify-fw__body';
  if (opts.maxHeight) body.style.maxHeight = opts.maxHeight;
  if (opts.bodyClickable) {
    body.classList.add('is-clickable');
    if (opts.bodyTitle) body.title = opts.bodyTitle;
    body.addEventListener('click', () => opts.onBodyClick?.());
  }

  root.append(head, body);

  // ── Сворачивание ────────────────────────────────────────────────────────────
  function applyCollapsed(): void {
    root.classList.toggle('is-collapsed', collapsed);
  }
  function setCollapsed(next: boolean): void {
    if (collapsed === next) return;
    collapsed = next;
    applyCollapsed();
    opts.onToggle?.(collapsed);
  }
  applyCollapsed();

  let collapseBtn: HTMLButtonElement | null = null;
  if (opts.collapsible) {
    collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'vkify-fw__btn';
    collapseBtn.setAttribute('aria-label', t('widget.collapse'));
    collapseBtn.title = t('widget.collapse_toggle');
    const sync = (): void => { collapseBtn!.textContent = collapsed ? '▢' : '–'; };
    sync();
    // pointerdown (не click): не запускаем перетаскивание шапки и не теряем клик
    // при частых ре-рендерах тела.
    collapseBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setCollapsed(!collapsed);
      sync();
    });
    head.appendChild(collapseBtn);
  }

  // ── Закрытие ────────────────────────────────────────────────────────────────
  if (opts.closable ?? true) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'vkify-fw__btn';
    closeBtn.setAttribute('aria-label', t('widget.close'));
    closeBtn.title = opts.closeTitle ?? t('widget.close');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (opts.onClose) opts.onClose();
      else destroy();
    });
    head.appendChild(closeBtn);
  }

  // ── Позиционирование ──────────────────────────────────────────────────────
  function place(pos: FloatingWidgetPosition | null): void {
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
  }

  const onResize = (): void => { if (current) place(current); };

  // ── Перетаскивание (за шапку) ─────────────────────────────────────────────
  head.addEventListener('pointerdown', (e: PointerEvent) => {
    const t = e.target as Element | null;
    if (t?.closest('button')) return; // не мешаем кнопкам шапки
    e.preventDefault();
    bringToFront();

    const rect = root.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    root.classList.add('is-dragging');

    const move = (ev: PointerEvent): void => {
      current = {
        left: clamp(ev.clientX - offX, 0, window.innerWidth - root.offsetWidth),
        top: clamp(ev.clientY - offY, 0, window.innerHeight - root.offsetHeight),
      };
      root.style.left = `${current.left}px`;
      root.style.top = `${current.top}px`;
    };
    const up = (): void => {
      root.classList.remove('is-dragging');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      // Персист — только на отпускании (одна запись на drag, не на каждый кадр).
      if (current) opts.onPositionChange?.(current);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });

  // Клик в любом месте панели поднимает её над остальными.
  root.addEventListener('pointerdown', () => bringToFront());

  // ── Публичный хэндл ───────────────────────────────────────────────────────
  function bringToFront(): void {
    root.style.zIndex = String(nextZ());
  }

  function mount(parent: HTMLElement = document.body): void {
    ensureFloatingWidgetStyles();
    if (!root.isConnected) parent.appendChild(root);
    bringToFront();

    // Дефолтная позиция применяется сразу (без «прыжка» из угла); сохранённая —
    // как только загрузчик её отдаст (синхронно для localStorage, позже для chrome.storage).
    const loaded = opts.loadPosition?.();
    if (loaded instanceof Promise) {
      place(null);
      loaded.then((p) => { if (p) place(p); }).catch(() => { /* нет доступа — оставляем дефолт */ });
    } else {
      place(loaded ?? null);
    }

    if (!resizeBound) {
      window.addEventListener('resize', onResize);
      resizeBound = true;
    }
  }

  function reattach(): void {
    if (!root.isConnected && document.body) document.body.appendChild(root);
  }

  function show(): void {
    if (!hidden) return; // идемпотентно: не перезапускаем анимацию на каждый рендер
    hidden = false;
    root.classList.remove('is-hidden');
    // Перезапуск keyframe-анимации появления (reflow между none и '').
    root.style.animation = 'none';
    void root.offsetHeight;
    root.style.animation = '';
  }

  function hide(): void {
    if (hidden) return;
    hidden = true;
    root.classList.add('is-hidden');
  }

  function destroy(): void {
    if (resizeBound) { window.removeEventListener('resize', onResize); resizeBound = false; }
    root.remove();
  }

  return {
    root, head, body, aux,
    mount, reattach,
    isMounted: () => root.isConnected,
    show, hide,
    setPosition: (pos) => place(pos),
    setCollapsed: (c) => {
      setCollapsed(c);
      if (collapseBtn) collapseBtn.textContent = collapsed ? '▢' : '–';
    },
    isCollapsed: () => collapsed,
    bringToFront,
    destroy,
  };
}
