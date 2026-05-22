/**
 * Per-session nonce for the sensitive page↔extension postMessage channels
 * (VK token, native-API proxy).
 *
 * Threat model — be honest about what this does and does not buy:
 *   - The injected scripts run in the page's MAIN world, so a determined
 *     attacker that already executes JS on vk.com shares our JS context and
 *     cannot be fully shut out by a nonce.
 *   - What the nonce DOES stop: trivial, passive `window.addEventListener
 *     ('message', …)` harvesting by unrelated page scripts, embedded iframes,
 *     and other extensions' content scripts that simply listen on the bus.
 *   - The decisive hardening pairs with this: we no longer scrape the token
 *     out of VK's own outgoing fetch bodies (that actively widened VK's
 *     attack surface), and every sensitive message is now origin-pinned.
 *
 * The content script generates the nonce and hands it to each injected script
 * via a `data-` attribute on the injecting <script> tag.
 */

export const VKIFY_NONCE_ATTR = 'data-vkify-nonce';

/** Content-script side: a fresh, unguessable per-page-load nonce. */
export function createChannelNonce(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Injected-script side: the nonce handed to us on our own <script> tag. */
export function readChannelNonce(): string {
  try {
    const s = document.currentScript as HTMLScriptElement | null;
    return s?.getAttribute(VKIFY_NONCE_ATTR) ?? '';
  } catch {
    return '';
  }
}

/** Constant-time-ish equality; both sides must present the same nonce. */
export function nonceMatches(expected: string, received: unknown): boolean {
  return typeof received === 'string' && received.length > 0 && received === expected;
}