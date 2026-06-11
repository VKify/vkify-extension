/**
 * Единая плавающая «карточка» VKify для контент-скриптов: центр загрузок,
 * дропдауны (экспорт диалога, выбор качества видео), прогресс-оверлеи.
 * Одна точка стилей — все всплывающие окна расширения выглядят одинаково.
 *
 * Позиционирование и ширина — на стороне фичи (доп. классом или inline),
 * карточка задаёт только внешний вид. Цвета — через vkui-переменные, чтобы
 * автоматически подхватывать тёмную тему VK.
 */

const CARD_CSS_ID = 'vkify-card-css';

const CARD_CSS = `
  @keyframes vkify-card-in   { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes vkify-card-drop { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  .vkify-card {
    position: fixed; z-index: 2147483646;
    display: flex; flex-direction: column;
    background: var(--vkui--color_background_modal, #fff);
    color: var(--vkui--color_text_primary, #19191a);
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 14px 44px rgba(0,0,0,.3), 0 0 0 1px rgba(127,127,127,.14);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .vkify-card__head {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 12px; font-size: 13px; font-weight: 700;
    border-bottom: 1px solid rgba(127,127,127,.16);
    flex-shrink: 0;
  }
  .vkify-card__list {
    overflow-y: auto; padding: 6px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .vkify-card__item {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 8px; border-radius: 9px;
  }
  .vkify-card__item:hover { background: rgba(127,127,127,.08); }
  button.vkify-card__item {
    width: 100%; border: none; background: transparent;
    color: inherit; text-align: left; font: inherit;
  }
  button.vkify-card__item, label.vkify-card__item, .vkify-card__item[role="button"] {
    cursor: pointer; user-select: none;
  }
  label.vkify-card__item { font-size: 12px; line-height: 1.3; }
  label.vkify-card__item input {
    margin: 0; flex-shrink: 0;
    accent-color: var(--vkui--color_text_accent, #2688eb);
  }
  .vkify-card__txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .vkify-card__title  { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vkify-card__status { font-size: 11px; color: var(--vkui--color_text_secondary, #818c99); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vkify-card__sep { height: 1px; background: rgba(127,127,127,.16); margin: 4px 8px 2px; flex-shrink: 0; }
`;

/** Внедряет стили карточки (идемпотентно). */
export function ensureCardStyles(): void {
  if (document.getElementById(CARD_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = CARD_CSS_ID;
  s.textContent = CARD_CSS;
  document.head.appendChild(s);
}

/** Удаляет стили карточки (для тестов/жёсткой очистки). */
export function removeCardStyles(): void {
  document.getElementById(CARD_CSS_ID)?.remove();
}

/** Логотип VKify (2-path SVG, currentColor). Единый источник для всех фич. */
export function buildVkifyLogo(size = 18): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 231 148');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'vkify-logo');
  svg.style.cssText = `width:${size}px;height:${Math.round(size * 148 / 231)}px;flex-shrink:0`;
  const p1 = document.createElementNS(ns, 'path');
  p1.setAttribute('fill', 'currentColor');
  p1.setAttribute('d', 'M73.711 1.83982L97.0564 57.5097C97.9202 59.5696 100.652 59.9968 102.103 58.2988L151.041 1.05066C151.611 0.383902 152.444 0 153.322 0H221.115C223.645 0 225.039 2.93882 223.438 4.898L107.853 146.382C107.275 147.089 106.408 147.494 105.496 147.484L63.8875 147.022C62.7028 147.008 61.6367 146.299 61.1668 145.211L0.249245 4.18967C-0.606304 2.2091 0.845833 0 3.00328 0H70.9444C72.153 0 73.2436 0.725252 73.711 1.83982Z');
  const p2 = document.createElementNS(ns, 'path');
  p2.setAttribute('fill', 'currentColor');
  p2.setAttribute('d', 'M138.702 122.916L173.168 82.1842C174.36 80.7756 176.529 80.7667 177.733 82.1655L229.675 142.544C231.349 144.488 229.967 147.5 227.401 147.5H160.202C159.395 147.5 158.621 147.175 158.057 146.597L138.848 126.952C137.766 125.845 137.703 124.098 138.702 122.916Z');
  svg.append(p1, p2);
  return svg;
}

export interface FloatingCardOptions {
  /** Заголовок шапки (с логотипом VKify). Без него шапка не создаётся. */
  title?: string;
  /** Доп. класс корня — позиционирование/ширина на стороне фичи. */
  className?: string;
}

export interface FloatingCard {
  root: HTMLElement;
  head: HTMLElement | null;
  /** Контейнер контента (.vkify-card__list). */
  list: HTMLElement;
}

/** Собирает карточку: [шапка с логотипом] + контейнер контента. */
export function createFloatingCard(opts: FloatingCardOptions = {}): FloatingCard {
  ensureCardStyles();

  const root = document.createElement('div');
  root.className = opts.className ? `vkify-card ${opts.className}` : 'vkify-card';

  let head: HTMLElement | null = null;
  if (opts.title) {
    head = document.createElement('div');
    head.className = 'vkify-card__head';
    head.appendChild(buildVkifyLogo(16));
    const title = document.createElement('span');
    title.textContent = opts.title;
    head.appendChild(title);
    root.appendChild(head);
  }

  const list = document.createElement('div');
  list.className = 'vkify-card__list';
  root.appendChild(list);

  return { root, head, list };
}
