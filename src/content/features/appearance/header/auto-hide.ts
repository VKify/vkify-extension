const HIDDEN = 'data-vkify-header-hidden';

/** One passive listener and at most one update per frame; SPA nodes share a marker. */
export function startAutoHideHeader(): () => void {
  const root = document.documentElement;
  let previous = window.scrollY;
  let direction = 0;
  let distance = 0;
  let frame = 0;
  const show = (): void => { root.removeAttribute(HIDDEN); distance = 0; };
  const inHeader = (target: EventTarget | null): boolean =>
    target instanceof Element && !!target.closest('#page_header_cont');
  const update = (): void => {
    frame = 0;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.max(0, Math.min(window.scrollY, max));
    const delta = y - previous;
    previous = y;
    if (root.hasAttribute('data-vkify-static_header') || y <= 48 || inHeader(document.activeElement)) {
      show(); direction = 0; return;
    }
    if (!delta) return;
    const nextDirection = Math.sign(delta);
    if (direction !== nextDirection) distance = 0;
    direction = nextDirection;
    distance += Math.abs(delta);
    if (distance < 12) return;
    if (direction > 0) {
      if (!root.hasAttribute(HIDDEN)) root.setAttribute(HIDDEN, '');
    } else show();
  };
  const scroll = (): void => { if (!frame) frame = window.requestAnimationFrame(update); };
  const reveal = (event: Event): void => { if (inHeader(event.target)) show(); };
  const reset = (): void => { previous = window.scrollY; direction = 0; show(); };
  show();
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('resize', reset);
  window.addEventListener('pageshow', reset);
  document.addEventListener('focusin', reveal);
  document.addEventListener('pointerover', reveal);
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener('scroll', scroll);
    window.removeEventListener('resize', reset);
    window.removeEventListener('pageshow', reset);
    document.removeEventListener('focusin', reveal);
    document.removeEventListener('pointerover', reveal);
    root.removeAttribute(HIDDEN);
  };
}
