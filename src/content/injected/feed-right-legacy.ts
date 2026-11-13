import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';

const MAX_TEXT = 4 * 1024 * 1024;
export function isLegacyFeedRightUrl(value: string): boolean {
  try {
    const url = new URL(value, location.href);
    return url.origin === location.origin && url.pathname === '/al_feed_right_block.php';
  } catch { return false; }
}

/** The legacy right-column injector consumes HTML, not newsfeed.getRightBlock JSON. */
export function filterLegacyFeedRight(value: unknown, report: (title: string) => void): boolean {
  let changed = false, visited = 0;
  const filterHtml = (html: string): string => {
    if (html.length > MAX_TEXT || !html.includes('feed_apps_right_block')) return html;
    // A template is inert: examining the response must not load its tracking images.
    const template = document.createElement('template'); template.innerHTML = html;
    let removed = false;
    for (const block of template.content.querySelectorAll('[data-testid="feed_apps_right_block"]')) {
      if (!block.classList.contains('apps_feedRightAppsBlock_single_app--promo')
        && !block.querySelector('[data-block-type="featured_promo_game"], [data-block-type="recommended_app"]')) continue;
      const title = block.querySelector('.apps_feedRightAppsBlock__name')?.textContent?.trim().slice(0, 300) || 'Игровой промоблок в ленте';
      block.remove(); removed = true; report(title);
    }
    if (!removed) return html;
    changed = true; return template.innerHTML;
  };
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 8 || ++visited > 1000) return;
    for (const key of Object.keys(node)) {
      const object = node as Record<string, unknown>, item = object[key];
      if (typeof item === 'string') object[key] = filterHtml(item);
      else visit(item, depth + 1);
    }
  };
  visit(value, 0); return changed;
}

export function filterLegacyFeedRightText(text: string, report: (title: string) => void): string {
  if (text.length > MAX_TEXT || !text.includes('feed_apps_right_block')) return text;
  const prefix = /^\s*<!--/.exec(text)?.[0] ?? '';
  try {
    const data = JSON.parse(text.slice(prefix.length));
    return filterLegacyFeedRight(data, report) ? prefix + JSON.stringify(data) : text;
  } catch {
    const parts = [text];
    return filterLegacyFeedRight(parts, report) ? parts[0] : text;
  }
}

/** Handle both current fetch and the legacy injector's XHR delivery before consumers read it. */
export function installLegacyFeedRight(enabled: () => boolean, report: (title: string) => void): () => void {
  const stopFetch = registerResponseHook(async (url, response) => {
    if (!enabled() || !response.ok || !isLegacyFeedRightUrl(url)) return response;
    const text = await response.clone().text();
    if (!enabled()) return response;
    const next = filterLegacyFeedRightText(text, report);
    if (next === text) return response;
    const headers = new Headers(response.headers);
    headers.delete('content-length'); headers.delete('content-encoding');
    return new Response(next, { status: response.status, statusText: response.statusText, headers });
  });
  const cache = new WeakMap<XMLHttpRequest, { source: string; value: string }>();
  const watched = new WeakSet<XMLHttpRequest>();
  const restores: Array<() => void> = [];
  for (const name of ['responseText', 'response'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, name);
    if (!descriptor?.get || !descriptor.configurable) continue;
    const get = function(this: XMLHttpRequest): unknown {
      const source = descriptor.get!.call(this);
      if (!enabled() || this.readyState !== 4 || !isLegacyFeedRightUrl(this.responseURL)) return source;
      if (typeof source !== 'string') {
        if (name === 'response' && this.responseType === 'json') filterLegacyFeedRight(source, report);
        return source;
      }
      if (!watched.has(this)) {
        watched.add(this);
        this.addEventListener('loadstart', () => cache.delete(this));
      }
      const previous = cache.get(this);
      if (previous?.source === source) return previous.value;
      const value = filterLegacyFeedRightText(source, report);
      cache.set(this, { source, value }); return value;
    };
    Object.defineProperty(XMLHttpRequest.prototype, name, { ...descriptor, get });
    restores.push(() => {
      if (Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, name)?.get === get)
        Object.defineProperty(XMLHttpRequest.prototype, name, descriptor);
    });
  }
  return () => { stopFetch(); restores.forEach(restore => restore()); };
}
