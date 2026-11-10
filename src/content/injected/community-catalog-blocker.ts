import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { filterCommunityCatalog, filterMainCatalogForYou } from './community-catalog.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';

const key = '__vkifyCommunityCatalogBlocker';
if (!Reflect.get(window, key)) {
  Reflect.set(window, key, true);
  let stop: (() => void) | undefined;
  const marker = 'data-vkify-community-for-you-filtered';
  const filterForYou = (data: unknown): boolean => {
    if (!filterMainCatalogForYou(data)) return false;
    document.documentElement.setAttribute(marker, '');
    return true;
  };

  const update = (event: Event): void => {
    const enabled = (event as CustomEvent).detail?.block_recommendations_communities;
    if (enabled === false) {
      stop?.();
      stop = undefined;
      document.documentElement.removeAttribute(marker);
    } else if (enabled === true && !stop) {
      const stopFetch = registerResponseHook(async (url, response) => {
        if (!stop || !response.ok || !url.startsWith('https://web.api.vk.ru/method/catalog.getGroups')) return response;
        const path = new URL(url).pathname;
        if (path !== '/method/catalog.getGroups') return response;
        const registration = stop;
        const data: unknown = await response.clone().json();
        if (stop !== registration || !(filterForYou(data) || filterCommunityCatalog(data))) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        headers.delete('content-encoding');
        return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
      });
      const stopPrefetch = interceptFeedPrefetch(window, entry => {
        if (entry.method !== 'catalog.getGroups') return;
        try { filterForYou(entry); } catch { /* VK must still receive the cache. */ }
      });
      stop = () => { stopFetch(); stopPrefetch(); };
    }
  };

  const destroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    stop?.();
    stop = undefined;
    document.documentElement.removeAttribute(marker);
    window.removeEventListener('vkify-update-settings', update);
    window.removeEventListener('message', destroy);
    Reflect.deleteProperty(window, key);
  };

  window.addEventListener('vkify-update-settings', update);
  window.addEventListener('message', destroy);
  window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name: 'community-catalog-blocker' } }));
}
