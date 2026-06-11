/** Единая иконка скачивания VKify. */

/**
 * Единая иконка скачивания VKify — глиф из @vkontakte/icons (download_24).
 * ОДИН источник для всех download-фич — не дублируйте inline-SVG в фичах.
 */
export function buildDownloadIconSvg(size = 24): SVGSVGElement {
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = `width:${size}px;height:${size}px;display:block`;
  const p = document.createElementNS(ns, 'path');
  p.setAttribute(
    'd',
    'M9 3h6v6h3.034a.4.4 0 0 1 .283.683l-6.034 6.034a.4.4 0 0 1-.566 0L5.683 9.683A.4.4 0 0 1 5.966 9H9zM6 18h12a1 1 0 0 1 0 2H6a1 1 0 0 1 0-2',
  );
  svg.appendChild(p);
  return svg;
}
