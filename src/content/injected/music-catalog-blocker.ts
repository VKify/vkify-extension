import { applyInitialSettings } from './initial-settings.js';
import { registerRequestHook, registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';
import { filterMusicCatalog, filterMusicResponse, musicBatchIds, MUSIC_CATALOG_METHODS } from './music-catalog.js';

const key = '__vkifyMusicCatalogBlocker';
if (!Reflect.get(window, key)) {
  Reflect.set(window, key, true);
  let stop: (() => void) | undefined;
  const batchUrl = 'https://web.api.vk.ru/method/batch.call';
  const requestIds = new WeakMap<Request, Set<string>>();
  const report = (removed: Record<string, unknown>[]): void => {
    for (const banner of removed) window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', domain: 'VK API · Музыка', method: 'api', section: 'block_music_ads',
      detail: String(banner.title ?? 'Рекламный баннер подписки').slice(0, 240),
      trigger: 'Рекламный баннер подписки',
    } }));
  };
  const update = (event: Event): void => {
    const enabled = (event as CustomEvent).detail?.block_music_ads;
    if (enabled === false) { stop?.(); stop = undefined; }
    else if (enabled === true && !stop) {
      // A Request body is consumed by native fetch; capture its small batch map first.
      const stopRequest = registerRequestHook(async (url, input, init) => {
        if (url.split('?')[0] !== batchUrl || !(input instanceof Request) || init?.body) return;
        requestIds.set(input, musicBatchIds(await input.clone().text()));
        return undefined;
      });
      const stopFetch = registerResponseHook(async (url, response, input, init) => {
        if (!stop || !response.ok || !url.startsWith('https://web.api.vk.ru/method/')) return response;
        const method = new URL(url).pathname.slice('/method/'.length);
        let ids: Set<string> | undefined;
        if (method === 'batch.call') {
          ids = init?.body ? musicBatchIds(init.body) : input instanceof Request ? requestIds.get(input) : undefined;
          if (!ids?.size) return response;
        } else if (!MUSIC_CATALOG_METHODS.has(method)) return response;
        const registration = stop;
        const data: unknown = await response.clone().json();
        if (stop !== registration) return response;
        const removed = filterMusicResponse(data, ids);
        if (!removed.length) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length'); headers.delete('content-encoding');
        report(removed);
        return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
      });
      const stopPrefetch = interceptFeedPrefetch(window, entry => {
        if (MUSIC_CATALOG_METHODS.has(entry.method)) report(filterMusicCatalog(entry.response));
      });
      stop = () => { stopRequest(); stopFetch(); stopPrefetch(); };
    }
  };
  const destroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    stop?.(); stop = undefined;
    window.removeEventListener('vkify-update-settings', update);
    window.removeEventListener('message', destroy);
    Reflect.deleteProperty(window, key);
  };
  window.addEventListener('vkify-update-settings', update);
  window.addEventListener('message', destroy);
}
applyInitialSettings();
window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name: 'music-catalog-blocker' } }));
