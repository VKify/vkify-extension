// Instant (FOUC-free) application of dynamically-injected feature CSS.
//
// A handful of features can't ship their CSS statically because they interpolate
// runtime values — content width, page offset, avatar radius, fonts, background.
// They call FeatureManager.injectCSS(id, css), which appends a <style> only after
// app.init() (DOMContentLoaded + async storage), so they visibly flash in.
//
// We mirror the last-injected CSS per id to the page's localStorage (synchronously
// readable at document_start, shared per-origin) and re-create the <style> elements
// before first paint. The authoritative reconcile after init prunes anything a
// feature didn't re-inject this session (e.g. toggled off while no tab was open).
//
// See also core/css-marker-mirror.ts (static gated CSS) and
// features/appearance/theme/mirror.ts (theme). Same idea, different payload.

const MIRROR_KEY = 'vkify:injected-css';

// Ids whose `enable` builds DOM as well as CSS (background wallpaper). Their CSS
// targets elements that don't exist at document_start, so we pre-create a minimal
// host for the common image case (video/web/embed need real loading — skipped).
const BG_ID = 'custom_background';

let mirror: Record<string, string> | null = null;
// Ids actually (re)injected this session — used by reconcile to prune the rest.
const sessionInjected = new Set<string>();

function read(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === 'object' ? (obj as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function persist(m: Record<string, string>): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(m));
  } catch {
    // quota / disabled storage — non-fatal
  }
}

function ensure(): Record<string, string> {
  if (!mirror) mirror = read();
  return mirror;
}

/** Record CSS injected this session so the next load can apply it instantly. */
export function recordInjectedCss(id: string, css: string): void {
  sessionInjected.add(id);
  const m = ensure();
  if (m[id] === css) return;
  m[id] = css;
  persist(m);
}

/** Drop CSS removed this session from the mirror. */
export function recordRemovedCss(id: string): void {
  const m = ensure();
  if (id in m) {
    delete m[id];
    persist(m);
  }
}

/** Pre-create the wallpaper host so a mirrored image background paints instantly. */
function ensureMirrorImageDom(): void {
  if (document.getElementById('vkify-bg-container')) return;
  const container = document.createElement('div');
  container.id = 'vkify-bg-container';
  const img = document.createElement('div');
  img.id = 'vkify-image-bg';
  container.appendChild(img);
  document.documentElement.appendChild(container);
}

/**
 * Synchronously re-create the mirrored <style> elements at document_start, before
 * first paint. CssManager.inject() later replaces them by id for enabled features.
 */
export function applyInjectedCssFromMirror(): void {
  const m = read();
  mirror = m;
  const root = document.documentElement;
  for (const [id, css] of Object.entries(m)) {
    if (typeof css !== 'string') continue;
    const style = document.createElement('style');
    style.id = `vkify-${id}`;
    style.textContent = css;
    root.appendChild(style);
    // Image background: the CSS targets #vkify-image-bg, which needs a host.
    if (id === BG_ID && css.includes('#vkify-image-bg')) ensureMirrorImageDom();
  }
}

/**
 * After app.init(), prune any mirrored entry a feature didn't re-inject this
 * session (toggled off while no tab was open) — removing both the stale <style>
 * and the persisted mirror entry, plus the wallpaper host if background is off.
 */
export function reconcileInjectedCss(): void {
  const m = read();
  let bgStale = false;
  for (const id of Object.keys(m)) {
    if (sessionInjected.has(id)) continue;
    if (id === BG_ID) bgStale = true;
    delete m[id];
    document.getElementById(`vkify-${id}`)?.remove();
  }
  persist(m);
  mirror = m;
  if (bgStale) {
    ['vkify-bg-container', 'vkify-image-bg'].forEach(id => document.getElementById(id)?.remove());
  }
}
