// Instant (FOUC-free) application of static CSS-feature markers.
//
// Every pure-static feature stylesheet in styles/features.css is gated behind
// `html[data-vkify-<id>]` and stays inert until that marker is set (see
// FeatureManager.enableCss). Normally the marker is set only after app.init()
// — which waits for DOMContentLoaded *and* an async chrome.storage read — so
// the page paints unstyled first and hide-features visibly flash.
//
// chrome.storage has no synchronous read, but the page's own localStorage is
// readable synchronously from the content-script's isolated world at
// document_start (storage is shared per-origin, not per-world). So we mirror
// the set of enabled CSS-feature ids there and stamp the markers on <html>
// synchronously, before first paint. The authoritative reconcile against
// chrome.storage happens later in FeatureManager.init (reconcileCssMarkers),
// which drops any marker that is stale (feature disabled while no tab was open)
// and rewrites the mirror.
//
// The mirror reveals nothing the page couldn't already observe: the same
// data-vkify-* attributes and feature stylesheets are present on the DOM
// regardless.

const MIRROR_KEY = 'vkify:css-markers';

// Ids stamped onto <html> from the mirror this page-load. Remembered so the
// later reconcile can remove the ones that turn out to be stale.
let appliedFromMirror: string[] = [];

function readMirror(): string[] {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is string => typeof id === 'string');
  } catch {
    return []; // corrupt / disabled storage — reconcile will heal it
  }
}

function writeMirror(ids: Iterable<string>): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify([...ids]));
  } catch {
    // quota exceeded / storage disabled — non-fatal, markers still work this load
  }
}

/**
 * Synchronously stamp `data-vkify-<id>` on <html> for every CSS feature the
 * mirror recorded as enabled. Call this as the very first thing in the content
 * script (document_start), before any paint.
 */
export function applyCssMarkersFromMirror(): void {
  const ids = readMirror();
  const el = document.documentElement;
  for (const id of ids) {
    el.setAttribute(`data-vkify-${id}`, 'true');
  }
  appliedFromMirror = ids;
}

/** Persist the current set of active CSS-feature markers for the next load. */
export function syncCssMarkerMirror(active: Iterable<string>): void {
  writeMirror(active);
}

/**
 * After app.init() has resolved the authoritative set of enabled CSS features,
 * remove any marker that was applied from the (stale) mirror but isn't actually
 * active, then rewrite the mirror to match reality.
 */
export function reconcileCssMarkers(active: ReadonlySet<string>): void {
  const el = document.documentElement;
  for (const id of appliedFromMirror) {
    if (!active.has(id)) el.removeAttribute(`data-vkify-${id}`);
  }
  appliedFromMirror = [...active];
  writeMirror(active);
}
