/**
 * Видимая вертикальная полоса popup'а, когда он встроен iframe'ом в страницу
 * vk.com/vkify_settings. Content-script (embed.ts) присылает её через
 * postMessage `VKIFY_EMBED_VIEWPORT`; модалки и onboarding используют её, чтобы
 * центрироваться по экрану, а не по середине длинного iframe.
 *
 * Координаты — в системе самого iframe (0 = верх его контента).
 */
export interface EmbedViewport {
  top: number;
  height: number;
}

let current: EmbedViewport | null = null;
const listeners = new Set<(v: EmbedViewport | null) => void>();

/** true, если popup рендерится во встроенном iframe (см. main.tsx). */
export function isEmbedded(): boolean {
  return document.documentElement.classList.contains('vkify-embedded');
}

export function getEmbedViewport(): EmbedViewport | null {
  return current;
}

export function setEmbedViewport(v: EmbedViewport | null): void {
  current = v;
  for (const l of listeners) l(v);
}

export function subscribeEmbedViewport(cb: (v: EmbedViewport | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
