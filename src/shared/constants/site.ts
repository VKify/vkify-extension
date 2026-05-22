/**
 * Companion-site base URL — environment-aware.
 *
 * Single source of truth for every link the extension opens to its own landing
 * (`vkify.ru` in production, `http://localhost:5173` in a dev build by default).
 * Replaced at build time by Vite `define` (`__VKIFY_SITE_URL__`) so the popup,
 * background SW and all classic / injected bundles agree on the same value.
 *
 * Override per build via the `VKIFY_SITE_URL` env var (e.g. a non-5173 port).
 *
 * SECURITY NOTE: do NOT use this for the security boundary of the site-bridge.
 * The bridge's content-script `matches` are controlled by the manifest, and
 * `http://localhost/*` is added there only by the dev build (see vite.config).
 * This constant is for outbound links the extension opens, not for trust.
 */

// Defined by Vite (see vite.config.ts → `define`). Always present in built
// artifacts. The runtime fallback below covers test environments and any
// accidental import path that bypasses the build (e.g. plain ts-node).
declare const __VKIFY_SITE_URL__: string;

function resolveSiteUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof __VKIFY_SITE_URL__ === 'string' && __VKIFY_SITE_URL__) {
      return __VKIFY_SITE_URL__.replace(/\/+$/, '');
    }
  } catch { /* ReferenceError outside the build */ }
  return 'https://vkify.ru';
}

/** Base URL, no trailing slash. */
export const SITE_URL: string = resolveSiteUrl();

/** Build a fully-qualified URL on the companion site. `path` may start with `/` or not. */
export function siteUrl(path: string = ''): string {
  if (!path) return SITE_URL;
  return path.startsWith('/') ? `${SITE_URL}${path}` : `${SITE_URL}/${path}`;
}

/** Hostname for cosmetic labels (e.g. "vkify.ru" / "localhost:5173"). */
export const SITE_HOST: string = (() => {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return 'vkify.ru';
  }
})();