import { applyInitialSettings } from './initial-settings.js';
import { suppressSidebarAdLoading } from './sidebar-ad-flags.js';
import { registerRequestHook, registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';
import { filterGamesPromos, filterRecentGroups, filterMarketRecommendations, filterSidebarAds } from './catalog-visibility.js';

const key = '__vkifyCatalogVisibility';
if (!Reflect.get(window, key)) {
  Reflect.set(window, key, true);
  const enabled: Record<string, boolean> = {};
  const restoreSidebarFlags = suppressSidebarAdLoading(window, () => enabled.block_left_ads === true);
  const apiMethod = (value: string): string | undefined => {
    try {
      const url = new URL(value, location.href);
      if (url.protocol === 'https:' && ['api.vk.ru', 'web.api.vk.ru'].includes(url.hostname)) return /^\/method\/([^/]+)$/.exec(url.pathname)?.[1];
    } catch { /* Unknown URLs pass through. */ }
  };
  const methods: Record<string, [string, (data: unknown) => boolean]> = {
    'account.getLeftAds': ['block_left_ads', filterSidebarAds],
    'apps.getWebGamesCatalog': ['block_recommendations_games', filterGamesPromos],
    'catalog.getClassifieds': ['block_recommendations_market', filterMarketRecommendations],
    'catalog.getGroups': ['hide_recent_groups', filterRecentGroups],
  };
  const filter = (method: string, data: unknown) => {
    const config = methods[method];
    if (!config || !enabled[config[0]]) return false;
    const changed = config[1](data);
    if (changed && config[0] === 'block_recommendations_games') window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', domain: 'VK API · Игры', method: 'api', section: 'block_recommendations_games',
      detail: 'Промоблоки каталога игр', trigger: 'Рекламные баннеры и социальные рекомендации',
    } }));
    if (changed && config[0] === 'block_recommendations_market') window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', domain: 'VK API · Маркет', method: 'api', section: 'block_recommendations_market',
      detail: 'Может заинтересовать', trigger: 'Рекомендательная карточка каталога',
    } }));
    if (changed && config[0] === 'block_left_ads') window.dispatchEvent(new CustomEvent('vkify:blocked', { detail: {
      kind: 'ad', domain: 'VK API · Реклама слева', method: 'api', section: 'block_left_ads',
      detail: 'Рекламный виджет боковой колонки', trigger: 'account.getLeftAds',
    } }));
    return changed;
  };
  const sectionBodies = new WeakMap<Request, string>();
  const marketContext = (body: unknown): boolean => {
    if (body instanceof URLSearchParams) return body.get('catalog_context') === 'market';
    if (typeof body !== 'string') return false;
    try { if (JSON.parse(body)?.catalog_context === 'market') return true; } catch { /* Form-encoded API body. */ }
    return new URLSearchParams(body).get('catalog_context') === 'market';
  };
  const batchMaps = new WeakMap<Request, Map<string, string>>();
  const parse = (body: unknown): Map<string, string> => {
    const map = new Map<string, string>();
    if (typeof body !== 'string') return map;
    try {
      const requests = JSON.parse(body)?.requests;
      if (Array.isArray(requests)) for (const r of requests) {
        const method = r?.method === 'catalog.getSection' && r?.params?.catalog_context === 'market' ? 'catalog.getClassifieds' : r?.method;
        if (methods[method] && enabled[methods[method][0]]) map.set(String(r.id), method);
      }
    } catch { /* Unknown bodies must pass through. */ }
    return map;
  };
  let stop: (() => void) | undefined;
  const update = (event: Event) => {
    const settings = (event as CustomEvent).detail;
    for (const [id] of Object.values(methods)) if (typeof settings?.[id] === 'boolean') enabled[id] = settings[id];
    if (!Object.values(enabled).some(Boolean)) { stop?.(); stop = undefined; return; }
    if (stop) return;
    const stopRequest = registerRequestHook(async (url, input, init) => {
      if (apiMethod(url) === 'batch.call' && input instanceof Request && !init?.body)
        batchMaps.set(input, parse(await input.clone().text()));
      if (enabled.block_recommendations_market && apiMethod(url) === 'catalog.getSection' && input instanceof Request && !init?.body)
        sectionBodies.set(input, await input.clone().text());
      return undefined;
    });
    const stopFetch = registerResponseHook(async (url, response, input, init) => {
      if (!stop || !response.ok) return response;
      let method = apiMethod(url);
      if (!method) return response;
      if (method === 'catalog.getSection') {
        const body = init?.body ?? (input instanceof Request ? sectionBodies.get(input) : undefined);
        if (!marketContext(body) && new URL(url).searchParams.get('catalog_context') !== 'market') return response;
        method = 'catalog.getClassifieds';
      }
      const batch = method === 'batch.call' ? init?.body ? parse(init.body) : input instanceof Request ? batchMaps.get(input) : undefined : undefined;
      if (method === 'batch.call' ? !batch?.size : !methods[method] || !enabled[methods[method][0]]) return response;
      const registration = stop;
      const data = await response.clone().json();
      if (stop !== registration) return response;
      let changed = false;
      if (batch && Array.isArray(data?.responses)) {
        for (const item of data.responses) { const name = batch.get(String(item?.id)); if (name) changed = filter(name, item?.body?.response) || changed; }
      } else changed = filter(method, data?.response);
      if (!changed) return response;
      const headers = new Headers(response.headers);
      headers.delete('content-length'); headers.delete('content-encoding');
      return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
    });
    const stopPrefetch = interceptFeedPrefetch(window, entry => {
      const request = entry.request as { catalog_context?: string; params?: { catalog_context?: string } } | undefined;
      const method = entry.method === 'catalog.getSection' && (request?.catalog_context === 'market' || request?.params?.catalog_context === 'market')
        ? 'catalog.getClassifieds' : entry.method;
      filter(method, entry.response);
    });
    stop = () => { stopRequest(); stopFetch(); stopPrefetch(); };
  };
  const destroy = (event: MessageEvent) => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    stop?.(); restoreSidebarFlags(); window.removeEventListener('vkify-update-settings', update); window.removeEventListener('message', destroy);
    Reflect.deleteProperty(window, key);
  };
  window.addEventListener('vkify-update-settings', update);
  window.addEventListener('message', destroy);
}
applyInitialSettings();
window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name: 'catalog-visibility-filter' } }));
