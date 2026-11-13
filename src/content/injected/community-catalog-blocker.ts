import { registerRequestHook, registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { filterCommunityCatalog, filterMainCatalogForYou, filterSimilarCommunityFlags } from './community-catalog.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';

const key = '__vkifyCommunityCatalogBlocker';
if (!Reflect.get(window, key)) {
  Reflect.set(window, key, true);
  let stop: (() => void) | undefined;
  const marker = 'data-vkify-community-for-you-filtered';
  const methods = new Set(['catalog.getGroups', 'groups.getById']);
  const methodOf = (value: string): string | undefined => {
    try {
      const url = new URL(value, location.href);
      if (url.protocol === 'https:' && ['web.api.vk.ru', 'api.vk.ru'].includes(url.hostname)) return /^\/method\/([^/]+)$/.exec(url.pathname)?.[1];
    } catch { /* Unknown endpoints pass through. */ }
  };
  const filter = (method: string, data: { response?: unknown }): boolean => {
    if (method === 'groups.getById') return filterSimilarCommunityFlags(data?.response);
    if (method !== 'catalog.getGroups') return false;
    if (filterMainCatalogForYou(data)) { document.documentElement.setAttribute(marker, ''); return true; }
    return filterCommunityCatalog(data);
  };
  const report = (method: string) => window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
    kind: 'ad', method: 'api', domain: 'VK API · Сообщества', section: 'block_recommendations_communities',
    detail: 'Рекомендации сообществ', trigger: method,
  } }));
  const bodies = new WeakMap<Request, string>();
  const update = (event: Event): void => {
    const enabled = (event as CustomEvent).detail?.block_recommendations_communities;
    if (enabled === false) {
      stop?.(); stop = undefined;
      document.documentElement.removeAttribute(marker);
    } else if (enabled === true && !stop) {
      const stopRequest = registerRequestHook(async (url, input, init) => {
        if (methodOf(url) === 'batch.call' && input instanceof Request && !init?.body) bodies.set(input, await input.clone().text());
        return undefined;
      });
      const stopFetch = registerResponseHook(async (url, response, input, init) => {
        const method = methodOf(url);
        if (!stop || !response.ok || (!methods.has(method ?? '') && method !== 'batch.call')) return response;
        const registration = stop;
        let requests: Map<string, string> | undefined;
        if (method === 'batch.call') {
          const body = init?.body ?? (input instanceof Request ? bodies.get(input) : undefined);
          if (typeof body !== 'string') return response;
          const list = JSON.parse(body)?.requests;
          if (!Array.isArray(list)) return response;
          requests = new Map(list.filter(item => methods.has(item?.method)).map(item => [String(item.id), item.method]));
          if (!requests.size) return response;
        }
        const data = await response.clone().json();
        if (stop !== registration) return response;
        let changed = false;
        if (requests && Array.isArray(data?.responses)) {
          for (const item of data.responses) { const name = requests.get(String(item?.id)); if (name) changed = filter(name, item?.body) || changed; }
        } else changed = filter(method!, data);
        if (!changed) return response;
        report(method!);
        const headers = new Headers(response.headers);
        headers.delete('content-length'); headers.delete('content-encoding');
        return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
      });
      const stopPrefetch = interceptFeedPrefetch(window, entry => {
        const changed = entry.method === 'groups.getById'
          ? filter(entry.method, entry) : entry.method === 'catalog.getGroups' && filterMainCatalogForYou(entry);
        if (changed) {
          if (entry.method === 'catalog.getGroups') document.documentElement.setAttribute(marker, '');
          report(entry.method);
        }
      });
      stop = () => { stopRequest(); stopFetch(); stopPrefetch(); };
    }
  };
  const destroy = (event: MessageEvent) => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    stop?.(); stop = undefined;
    document.documentElement.removeAttribute(marker);
    window.removeEventListener('vkify-update-settings', update);
    window.removeEventListener('message', destroy);
    Reflect.deleteProperty(window, key);
  };
  window.addEventListener('vkify-update-settings', update);
  window.addEventListener('message', destroy);
}
window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name: 'community-catalog-blocker' } }));
