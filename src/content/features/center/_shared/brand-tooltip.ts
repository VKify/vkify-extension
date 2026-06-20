/**
 * Фирменный tooltip VKify (общий для всех download-фич).
 *
 * Один элемент на body (position:fixed → не клиппится контейнерами VK).
 * Тёмная «пилюля» с фирменной точкой-градиентом и стрелкой снизу — узнаваемо
 * и единообразно во всех фичах. Нативный VK-тултип из content-скрипта вызвать
 * нельзя (page-global + inline-handler под CSP), поэтому рисуем свой.
 */

const BRAND_TIP_CSS_ID = 'vkify-tip-css';
const BRAND_TIP_ATTR   = 'data-vkify-tip';
let brandTipEl: HTMLElement | null = null;

function ensureBrandTipStyles(): void {
  if (document.getElementById(BRAND_TIP_CSS_ID)) return;
  const s = document.createElement('style');
  s.id = BRAND_TIP_CSS_ID;
  s.textContent = `
    @keyframes vkify-tip-in {
      from { opacity: 0; transform: translate(-50%, calc(-100% - 2px)); }
      to   { opacity: 1; transform: translate(-50%, calc(-100% - 8px)); }
    }
    @keyframes vkify-tip-spin { to { transform: rotate(360deg); } }
    .vkify-tip {
      position: fixed; z-index: 2147483647;
      transform: translate(-50%, calc(-100% - 8px));
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 13px 7px 11px; border-radius: 11px;
      font: 600 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      letter-spacing: .2px; white-space: nowrap; pointer-events: none;
      color: #fff;
      background:
        linear-gradient(150deg, rgba(34,36,44,.96), rgba(18,19,24,.96));
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
      box-shadow:
        0 10px 34px rgba(0,0,0,.5),
        0 0 0 1px rgba(255,255,255,.07) inset,
        0 0 22px rgba(122,140,255,.22);
      opacity: 0;
    }
    /* фирменная «искра»-индикатор — крутящийся конический градиент */
    .vkify-tip::before {
      content: ''; flex: 0 0 auto;
      width: 9px; height: 9px; border-radius: 50%;
      background: conic-gradient(from 0deg, #4da3ff, #8a6cff, #ff6ca3, #4da3ff);
      box-shadow: 0 0 9px rgba(122,140,255,.95);
      animation: vkify-tip-spin 2.8s linear infinite;
    }
    /* хвостик-стрелка снизу */
    .vkify-tip::after {
      content: ''; position: absolute; top: 100%; left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent; border-top-color: rgba(18,19,24,.96);
    }
    .vkify-tip.is-visible { opacity: 1; animation: vkify-tip-in .16s ease-out forwards; }
  `;
  document.head.appendChild(s);
}

function getBrandTip(): HTMLElement {
  ensureBrandTipStyles();
  if (brandTipEl && brandTipEl.isConnected) return brandTipEl;
  brandTipEl = document.createElement('div');
  brandTipEl.className = 'vkify-tip';
  brandTipEl.setAttribute(BRAND_TIP_ATTR, '');
  document.body.appendChild(brandTipEl);
  return brandTipEl;
}

/** Показывает фирменный tooltip над `anchor` с заданным текстом. */
export function showBrandTooltip(anchor: Element, text: string): void {
  const tip = getBrandTip();
  tip.textContent = text; // ::before/::after — псевдоэлементы, остаются
  const r = anchor.getBoundingClientRect();
  tip.style.left = `${r.left + r.width / 2}px`;
  tip.style.top  = `${r.top - 8}px`;
  tip.classList.add('is-visible');
}

export function hideBrandTooltip(): void {
  brandTipEl?.classList.remove('is-visible');
}

/** Навешивает фирменный tooltip на hover. `text` может быть функцией (ленивый). */
export function attachBrandTooltip(el: HTMLElement, text: string | (() => string)): void {
  el.addEventListener('mouseenter', () => showBrandTooltip(el, typeof text === 'function' ? text() : text));
  el.addEventListener('mouseleave', hideBrandTooltip);
}

/** Удаляет общий tooltip-элемент (при выключении фич). */
export function removeBrandTooltip(): void {
  brandTipEl?.remove();
  brandTipEl = null;
  document.getElementById(BRAND_TIP_CSS_ID)?.remove();
}
