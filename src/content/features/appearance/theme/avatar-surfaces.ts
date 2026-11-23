const CANDIDATES = 'img, svg image, [role="img"]';
const MARKERS = ['data-vkify-avatar-surface', 'data-vkify-avatar-clip', 'data-vkify-avatar-ring'];

function square(rect: DOMRect): boolean {
  return rect.width >= 12 && Math.abs(rect.width - rect.height) <= Math.max(1, rect.width * .03);
}
function round(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (!square(rect)) return false;
  const style = getComputedStyle(element);
  return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius]
    .every(radius => radius.split(/\s+/).every(value => value.endsWith('%') ? parseFloat(value) >= 49 : parseFloat(value) >= rect.width * .49))
    || style.clipPath.startsWith('circle(');
}
function circleClip(element: Element): boolean {
  const clip = element.getAttribute('clip-path') || getComputedStyle(element).clipPath;
  const id = clip.match(/#([^)"]+)/)?.[1];
  return !!id && !!document.getElementById(id)?.querySelector('circle');
}

/** Recognize native circular image surfaces by paint geometry, not VK names.
 * Observe only changed subtrees; hidden images are retried after resize/load. */
export function observeAvatarSurfaces(): () => void {
  const known = new Map<Element, Set<Element>>();
  const pending = new Set<Element>();
  const marked = new Set<Element>();
  let frame = 0;
  let stopped = false;
  const mark = (element: Element, attribute = MARKERS[0]) => {
    if (!element.hasAttribute(attribute)) element.setAttribute(attribute, '');
    marked.add(element);
  };
  function forget(image: Element): void {
    for (const surface of known.get(image) ?? []) {
      MARKERS.forEach(attr => surface.removeAttribute(attr));
      (surface as HTMLElement).style?.removeProperty('--vkify-avatar-ring-width');
      marked.delete(surface);
    }
    known.delete(image);
  }
  function scan(image: Element): void {
    if (!image.isConnected || image.closest('[data-vkify-widget], [data-vkify-embed]')) return;
    const rect = image.getBoundingClientRect();
    if (!square(rect)) return;
    if (/[?&]type=(audio|video)(?:&|$)/.test(image.getAttribute('src') || '')) return;
    const surfaces: Element[] = [image];
    for (let node = image.parentElement; node && node !== document.body; node = node.parentElement) {
      const bounds = node.getBoundingClientRect();
      if (Math.abs(bounds.width - rect.width) > 4 || Math.abs(bounds.height - rect.height) > 4) break;
      if (node.querySelectorAll('img, image').length > 1) break;
      surfaces.push(node);
    }
    if (!known.has(image) && !surfaces.some(node => round(node) || circleClip(node))
        && !/[?&]ava=1(?:&|$)/.test(image.getAttribute('src') || '')) return;
    const owned = known.get(image) ?? new Set<Element>();
    for (const surface of surfaces) {
      mark(surface); owned.add(surface);
      if (circleClip(surface) || getComputedStyle(surface).clipPath.startsWith('circle(')) mark(surface, MARKERS[1]);
      // Matching-sized tint/outline layers must follow the image. Do not touch
      // text, badges or controls attached to the avatar.
      for (const layer of surface.children) {
        if (layer === image || layer.contains(image) || layer.matches('button, a, svg') || layer.textContent?.trim()) continue;
        const bounds = layer.getBoundingClientRect();
        if (Math.abs(bounds.width - rect.width) <= 4 && Math.abs(bounds.height - rect.height) <= 4) {
          mark(layer); owned.add(layer);
        }
      }
    }
    // Native hollow story rings expose their thickness as a CSS length. Keep
    // their gradient/color and replace only the circular cutout.
    const host = surfaces[surfaces.length - 1];
    for (const ring of host.querySelectorAll('[style]')) {
      const style = getComputedStyle(ring);
      if (!style.clipPath.startsWith('path(')) continue;
      const arcs = [...style.clipPath.matchAll(/[aA]\s*([\d.]+)/g)].map(match => Number(match[1]));
      const radii = [...new Set(arcs)].sort((a, b) => b - a);
      if (radii.length !== 2 || radii[0] <= radii[1]) continue;
      const width = `${radii[0] - radii[1]}px`;
      (ring as HTMLElement).style.setProperty('--vkify-avatar-ring-width', width);
      mark(ring, MARKERS[2]); owned.add(ring);
    }
    known.set(image, owned);
  }
  function flush(): void {
    frame = 0;
    for (const [image] of known) if (!image.isConnected) forget(image);
    for (const element of marked) if (!element.isConnected) {
      MARKERS.forEach(attr => element.removeAttribute(attr)); marked.delete(element);
    }
    const batch = [...pending]; pending.clear();
    batch.forEach(scan);
  }
  function enqueue(root: Element): void {
    if (root.matches(CANDIDATES)) pending.add(root);
    root.querySelectorAll(CANDIDATES).forEach(image => pending.add(image));
    if (!frame && !stopped) frame = requestAnimationFrame(flush);
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(node => { if (node instanceof Element) enqueue(node); });
      else if (record.target instanceof Element) {
        // Ignore our own ring-width mutation; all paint changes use markers.
        if (record.attributeName === 'style' && record.target.hasAttribute(MARKERS[2])) continue;
        // Native components recycle image elements for other content. Remove
        // our geometry before reclassifying so our own radius is never evidence.
        for (const [image, surfaces] of known) {
          if (record.target === image || record.target.contains(image) || surfaces.has(record.target)) forget(image);
        }
        enqueue(record.target);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href', 'class', 'style', 'width', 'height'] });
  const load = (event: Event) => { if (event.target instanceof Element) enqueue(event.target); };
  const resize = () => enqueue(document.documentElement);
  document.addEventListener('load', load, true);
  window.addEventListener('resize', resize);
  enqueue(document.documentElement);
  return () => {
    stopped = true; observer.disconnect(); cancelAnimationFrame(frame);
    document.removeEventListener('load', load, true); window.removeEventListener('resize', resize);
    for (const element of marked) {
      MARKERS.forEach(attr => element.removeAttribute(attr));
      (element as HTMLElement).style?.removeProperty('--vkify-avatar-ring-width');
    }
    marked.clear(); known.clear(); pending.clear();
  };
}
