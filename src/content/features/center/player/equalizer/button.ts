/**
 * Кнопка быстрого доступа к эквалайзеру в нижнем плеере VK.
 * Вставляется в ту же группу кнопок, что и кнопка скачивания (controls.ts),
 * наследует хешированный VKUI-класс соседней кнопки → выглядит нативно.
 * Клик переключает плавающую панель (panel.ts).
 */
import { queryAll } from '@/content/core/dom/query.js';
import { SELECTORS } from '@/content/selectors/index.js';
import { attachBrandTooltip, hideBrandTooltip } from '../../_shared/index.js';

export const EQ_BTN_ATTR = 'data-vkify-eq-btn';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Иконка «вертикальные ползунки» (эквалайзер). */
function buildEqIcon(size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = `width:${size}px;height:${size}px`;
  const mk = (d: string): SVGPathElement => {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '1.8');
    p.setAttribute('stroke-linecap', 'round');
    return p;
  };
  // Три вертикальные «дорожки» с «ручками» на разной высоте.
  svg.appendChild(mk('M6 4v6M6 14v6'));
  svg.appendChild(mk('M12 4v2M12 10v10'));
  svg.appendChild(mk('M18 4v10M18 18v2'));
  const knob = (cx: number, cy: number): SVGCircleElement => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', '2');
    c.setAttribute('fill', 'currentColor');
    return c;
  };
  svg.appendChild(knob(6, 12));
  svg.appendChild(knob(12, 8));
  svg.appendChild(knob(18, 16));
  return svg;
}

/**
 * Вставляет кнопку во ВСЕ плееры на странице (идемпотентно). На vk.com может быть
 * несколько плееров одновременно (мини-плеер в шапке + плеер на странице), поэтому
 * перебираем все группы кнопок, а не только первую. onToggle — клик.
 */
export function injectEqualizerButton(onToggle: () => void): void {
  for (const group of queryAll(SELECTORS.music.playerButtons)) {
    if (group.querySelector(`[${EQ_BTN_ATTR}]`)) continue;

    const sample = group.querySelector('button');
    const btnClass = (sample?.className ?? 'vkuiIconButton__host').trim();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = btnClass;
    btn.setAttribute(EQ_BTN_ATTR, '');
    btn.setAttribute('aria-label', 'Эквалайзер');
    if (sample?.getAttribute('style')) btn.setAttribute('style', sample.getAttribute('style')!);
    btn.appendChild(buildEqIcon());

    // Фирменный tooltip VKify — как у кнопки скачивания (единый стиль).
    attachBrandTooltip(btn, 'Эквалайзер');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBrandTooltip();
      onToggle();
    });

    group.appendChild(btn);
  }
}

/** Подсветить кнопку, когда панель открыта. */
export function setEqualizerButtonActive(open: boolean): void {
  document.querySelectorAll(`[${EQ_BTN_ATTR}]`).forEach(el => el.classList.toggle('is-open', open));
}

export function removeEqualizerButton(): void {
  document.querySelectorAll(`[${EQ_BTN_ATTR}]`).forEach(el => el.remove());
}
