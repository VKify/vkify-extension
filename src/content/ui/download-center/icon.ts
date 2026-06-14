/** Иконки, специфичные для центра загрузок. */

/**
 * Иконка-«ручка» перетаскивания — глиф drag_reorder_outline_24 из
 * @vkontakte/icons (стрелки вверх/вниз + полосы): подсказывает, что карточку
 * можно таскать. Native-тултип через вложенный <title>.
 */
export function buildDragHandleIcon(size = 18): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-label', 'Перетащите окно');
  svg.setAttribute('class', 'vkify-dl-center__grip');
  svg.style.cssText = `width:${size}px;height:${size}px;flex-shrink:0;display:block`;
  const title = document.createElementNS(ns, 'title');
  title.textContent = 'Перетащите окно';
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('fill-rule', 'evenodd');
  p.setAttribute('clip-rule', 'evenodd');
  p.setAttribute('d', 'M13.964 6.134a.9.9 0 0 0 1.272-1.273l-2.598-2.597a.9.9 0 0 0-1.272-.001L8.764 4.86a.9.9 0 0 0 1.272 1.274L12 4.172l1.963 1.962ZM3.9 9.2a.9.9 0 1 0 0 1.8h16.2a.9.9 0 1 0 0-1.8H3.9Zm0 3.8a.9.9 0 1 0 0 1.8h16.2a.9.9 0 1 0 0-1.8H3.9Zm4.868 4.867a.9.9 0 0 1 1.273 0l1.961 1.96 1.96-1.96a.9.9 0 0 1 1.274 1.272l-2.598 2.598a.9.9 0 0 1-1.272 0l-2.598-2.598a.9.9 0 0 1 0-1.272Z');
  svg.append(title, p);
  return svg;
}
